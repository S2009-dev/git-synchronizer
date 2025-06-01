import { Command } from "commander";
import express from "express";
import { RepoConf, RepoSyncConf, ServeOptions, UserConf } from "../utils/types";
import configManager from "../utils/configManager";
import verifySignature from "../utils/verifySignature";
import os from "os"
import { ChildProcess, exec } from "child_process";

/**
 * Command to run the synchronizer server.
 * @returns Command object and its callback function.
 * @see Command
 * @see express
 * @see configManager
 * @see verifySignature
 */
export default {
    cmd: new Command()
        .name("serve")
        .description("Run the synchronizer server")
        .option('-p, --port [port]', 'Port to run the server on (can also be set in the config)', parseInt),
        
    callback: async (cmd: Command, options: ServeOptions): Promise<void> => {
        const app: express.Application = express();
        const port: number = typeof options.port === 'number' && options.port > 0 ? options.port : configManager.get('server.port') || 3000;
        const redirectUrl: string = "https://npmjs.com/package/git-synchronizer";

        app.use(express.json())

        app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
            if (req.method !== 'POST') {
                return res.redirect(redirectUrl);
            }

            next();
        });

        app.post('/', (req: express.Request, res: express.Response): void => {
            const headers = req.headers;
            const payload = req.body;

            const existingUser: UserConf | undefined = configManager.get(`users.${payload.repository.owner.name}`);
            
            if(!existingUser) {
                res.status(404).send(`User ${payload.repository.owner.name} not found in server configuration`);
                return;
            }

            if(!verifySignature(existingUser.secret || "", headers['x-hub-signature-256'] as string || "", payload)) {
                res.status(401).send('Invalid signature');
                return;
            }

            res.status(202).send('Accepted');

            const event: string | undefined = headers["x-github-event"] as string;
            if(event === "ping"){
                console.log("Received ping event from GitHub");
            } else if(event === "push" || event === "release"){
                console.log(`Received ${event} event for repository ${payload.repository.name} from GitHub`);
            
                const ownerName: string = payload.repository.owner.name;
                const repoName: string = payload.repository.name;
                const repo: RepoConf | undefined = configManager.get(`users.${ownerName}.repositories.${repoName.toLowerCase()}`);
                if(!repo) {
                    console.log(`Repository ${payload.repository.full_name} isn't handled by the server.`);
                    return;
                }

                const conf: RepoSyncConf | undefined = event === "release" ? repo.releases : repo.commits;
                if(!conf) {
                    console.error(`No configuration found for ${event} event for repository ${payload.repository.full_name}.`);
                    return;
                }

                const commandPrefix: string = os.platform() === "win32" ? "" : `sudo -u ${conf.user} `;
                const postCommand: string = conf.postcmd === "none" ? "" : ` && ${commandPrefix}${conf.postcmd}`;
                const command: string = `cd ${conf.folder} && ${commandPrefix}git pull${postCommand}`;
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

        app.listen(port, (): void => {
            console.log(`Synchronizer server is listening on port ${port} (Press CTRL + C to stop it).`);
        });
    }
}
