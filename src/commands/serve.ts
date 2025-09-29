import { Command } from "commander";
import express from "express";
import { RepoConf, RepoSyncConf, ServeOptions, UserConf } from "../utils/types";
import configManager from "../utils/configManager";
import verifySignature from "../utils/verifySignature";
import { ChildProcess, exec } from "child_process";
import fetch from "node-fetch"
import path from "path"
import fs from "fs"
import os from "os"

/**
 * Command to run the synchronizer server
 *  
 * @returns Command object and its callback function
 */
export default {
    /**
     * The command object
     * 
     * @requires commander
     * 
     * @name serve
     * @description Run the synchronizer server
     * 
     * @argument -p / --port 
     * @param [port] Port to run the server on (can also be set in the config)
     * @default 3000
     * 
     * @returns "serve" command object
     * 
     * @remarks If the port argument is set, it will override the config's port
     * 
     * @example ```sh
     *  git-synchronizer serve --port 1234
     * ```
     */
    cmd: new Command()
        .name("serve")
        .description("Run the synchronizer server")
        .option('-p, --port [port]', 'Port to run the server on (can also be set in the config)', parseInt),
        
    /**
     * Run an express server to listen for Github API events
     * 
     * @requires commander
     * @requires ServeOptions
     * @requires express
     * 
     * @param cmd The command object
     * @param options The options passed to command
     * 
     * @returns "serve" command callback
     */
    callback: async (_cmd: Command, options: ServeOptions): Promise<void> => {
        const app: express.Application = express();
        const port: number = typeof options.port === 'number' && options.port > 0 ? options.port : configManager.get('server.port') || 3000;
        const redirectUrl: string = "https://npmjs.com/package/git-synchronizer";

        app.use(express.json())

        // Redirect bad requests to the package page
        app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
            if (req.method !== 'POST') {
                return res.redirect(redirectUrl);
            }

            next();
        });

        // Handle POST requests like Github API events
        app.post('/', (req: express.Request, res: express.Response): void => {
            const headers = req.headers;
            const payload = req.body;

            const existingUser: UserConf | undefined = configManager.get(`users.${payload.repository.owner.login}`);
            
            if(!existingUser) {
                res.status(404).send(`User ${payload.repository.owner.login} not found in server configuration`);
                return;
            }

            if(!verifySignature(existingUser.secret || "", headers['x-hub-signature-256'] as string || "", payload)) {
                res.status(401).send('Invalid signature');
                return;
            }

            res.status(202).send('Accepted');

            // Check if the event is supported by the git-synchronizer (https://docs.github.com/en/webhooks/webhook-events-and-payloads)
            const event: string | undefined = headers["x-github-event"] as string;
            if(event === "ping"){
                console.log("Received ping event from GitHub");
            } else if(event === "push" || event === "workflow_run" || event === "release"){
                const ownerName: string = payload.repository.owner.login;
                const repoName: string = payload.repository.name;
                const repo: RepoConf | undefined = configManager.get(`users.${ownerName}.repositories.${repoName.toLowerCase()}`);
                let conf: RepoSyncConf | undefined;
                
                if(!repo) return console.log(`Repository ${payload.repository.full_name} isn't handled by the server.`);

                if(event === "push"){
                    conf = repo.commits;
                    console.log(`Received ${event} event for repository ${payload.repository.name} from GitHub`);
                } else if(event === "workflow_run") {
                    if(payload.action === "completed"){
                        conf = repo.workflow_run;
                        console.log(`Received ${event} event with action ${payload.action} for repository ${payload.repository.name} from GitHub`);
                    } else {
                        return console.log(`Received ${event} event ${payload.action} from GitHub (not handled)`);
                    }
                } else if(event === "release") {
                    if(payload.action === "released"){
                        conf = repo.releases;
                        console.log(`Received ${event} event with action ${payload.action} for repository ${payload.repository.name} from GitHub`);
                    } else {
                        return console.log(`Received ${event} event ${payload.action} from GitHub (not handled)`);
                    }
                }

                if(!conf) return console.error(`No configuration found for ${event} event for repository ${payload.repository.full_name}.`);
                
                const commandPrefix: string = os.platform() === "win32" ? "" : `sudo -u ${conf.user} `;
                const postCommand: string = conf.postcmd === "none" ? "" : ` && ${commandPrefix}${conf.postcmd}`;
                let command: string = "";

                if(event === "push"){
                    command = `cd ${conf.folder} && ${commandPrefix}git pull${postCommand}`;
                } else if (event === "workflow_run") {
                    fetch(payload.workflow_run.artifacts_url, {
                        headers: {
                            'Authorization': `Bearer ${existingUser.token}`,
                            'Accept': 'application/vnd.github+json'
                        }
                    })
                    .then(res => res.json())
                    .then(async (data) => {
                        const artifact = data.artifacts.find(
                            (a: { name: string }) => a.name === conf.dl_filename
                        );

                        if (!artifact) {
                            throw new Error(`Artifact with name "${conf.dl_filename}" not found.`);
                        }

                        const downloadResponse: fetch.Response = await fetch(artifact.archive_download_url, {
                            headers: {
                            'Authorization': `Bearer ${existingUser.token}`,
                            'Accept': 'application/vnd.github+json'
                            }
                        });

                        const buffer = await downloadResponse.buffer();

                        fs.writeFileSync(path.join(conf.folder as string, `artifact-${artifact.id}.zip`), buffer);
                        command = `cd ${conf.folder} && unzip artifact-${artifact.id}.zip && rm artifact-${artifact.id}.zip && chown -R ${conf.user}:${conf.user} ${conf.folder}`
                    })
                    .catch(err => console.error('An error occured while downloading artifact :', err));
                } else if (event === "release") {
                    const asset = payload.release.assets.find(
                        (a: { name: string }) => a.name === conf.dl_filename
                    );

                    if (!asset) return console.log(`Asset with name "${conf.dl_filename}" not found.`);

                    fetch(asset.browser_download_url, {
                        headers: {
                        'Authorization': `Bearer ${existingUser.token}`,
                        'Accept': 'application/vnd.github+json'
                        }
                    })
                    .then(res => res.buffer())
                    .then(async (data) => {
                        fs.writeFileSync(path.join(conf.folder as string, `asset-${asset.id}.zip`), data);
                        command = `cd ${conf.folder} && unzip asset-${asset.id}.zip && rm asset-${asset.id}.zip && chown -R ${conf.user}:${conf.user} ${conf.folder}`;
                    })
                    .catch(err => console.error('An error occured while downloading asset :', err));
                }

                if(!command) return;

                const exe: ChildProcess = exec(command, (error, stdout, stderr): void => {
                    if (error) {
                        console.error(error.message);
                    }
        
                    if (stderr) {
                        console.error(stderr);
                    }
                });
        
                exe.on("exit", (code: number) => {
                    if (code === 0) {
                        console.log(`Successfully synced ${conf.folder} folder with ${payload.repository.full_name} repository !`);
                    }
                });
            } else {
                console.log(`Received ${event} event from GitHub (not handled)`);
            }
        });

        // Run the express server
        app.listen(port, (): void => {
            console.log(`Synchronizer server is listening on port ${port} (Press CTRL + C to stop it).`);
        });
    }
}
