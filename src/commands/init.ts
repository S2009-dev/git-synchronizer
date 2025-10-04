import { Argument, Command } from "commander";
import inquirer from "inquirer";
import os from "os";
import configManager from "../utils/configManager";
import { RepoConf, RepoSyncConf, SyncConf, UserConf, Webhook } from "../utils/types";
import { ChildProcess, exec } from "child_process";
import { createHash } from "crypto"
import fs from "fs";
import path from "path";

/**
 * Command to initialize a synchronization with a GitHub repository in a folder
 * 
 * @returns Command object and its callback function
 */
export default {
    /**
     * The command object
     * 
     * @requires commander
     * 
     * @name init
     * @description Sync a folder with a GitHub repository
     * 
     * @param username GitHub account username to sync with
     * @param repository GitHub repository name to sync with
     * 
     * @param branch Branch to sync with
     * @default main
     * 
     * @param path Path to the folder to sync
     * @default current directory
     * 
     * @param user OS user who will run processes
     * @default current user who runs the command
     * 
     * @param type When to sync
     * @default commit
     * 
     * @param post-install Run a command after syncing
     * @default none
     * 
     * @returns "init" command object
     * 
     * @remarks If the port argument is set, it will override the config's port
     * 
     * @example ```sh
     *  git-synchronizer init JohnDoe cool-repo master "/home/jd/cool" debian release "npm install"
     * ```
     */
    cmd: new Command()
        .name("init")
        .description("Sync a folder with a GitHub repository")
        .argument('[git_user]', 'GitHub account username that owns the "repository" to sync with')
        .argument('[repository]', 'GitHub repository name to sync with')
        .argument('[branch]', 'Branch to sync with', 'main')
        .argument('[folder]', 'Path to the folder to sync with', process.cwd())
        .argument('[os_user]', 'Name of the OS user who will have the permissions in the "folder" and who will perform the "post-install" command', os.userInfo().username)
        .argument('[dl_filename]', 'Name of the asset/artifact file to download (in case of the action isn\'t set to "push")')
        .addArgument(new Argument('[action]', 'Action that trigger sync').choices(['push', 'workflow_run', 'release']).default('push'))
        .addArgument(new Argument('[post-install]', 'Run a command after syncing (example: "sh myfile.sh" if you choose "custom")').choices(['npm install', 'composer install', 'custom', 'none']).default('none')),

    /**
     * Init a synchronization between a repository and a local directory
     * 
     * @requires commander
     * @requires configManager
     * @requires child_process
     * 
     * @param cmd The command object
     * 
     * @returns "init" command callback
     */
    callback: async (cmd: Command): Promise<void> => {
        const config: UserConf = {
            repositories: {
                [cmd.args[1] ?? "unknown"]: {
                    push: {},
                    release: {},
                    workflow_run: {}
                }
            }
        };

        const repoSync: RepoSyncConf = {
            secret: createHash('sha256').update(crypto.randomUUID()).digest('hex'),
            hook_id: 0,
            folder: cmd.args[3],
            dl_filename: cmd.args[5],
            os_user: cmd.args[4],
            postcmd: cmd.args[7]
        }

        const sync: SyncConf = {
            branch: cmd.args[2],
            repository: cmd.args[1],
            git_user: cmd.args[0],
            action: cmd.args[6] as keyof RepoConf
        };

        // Check if the "git_user" argument is set or ask for it
        if(!cmd.args[0]) {
            if(!configManager.get("users")) {
                console.error("No GitHub accounts found in configuration\nPlease add one using the config command (git-synchronizer config --add-user)");
                return process.exit(1);
            }

            const choices: string[] = Object.keys(configManager.get("users"));

            if(choices.length === 0) {
                console.error("No GitHub accounts found in configuration\nPlease add one using the config command (git-synchronizer config --add-user)");
                return process.exit(1);
            } else if(choices.length === 1) {
                console.log(`Using the only one GitHub account existing in configuration: ${choices[0]}`);
                sync.git_user = choices[0];
            } else {
                const namePrompt: { answer: string } = await inquirer.prompt({
                    type: "list",
                    name: "answer",
                    message: "Select the GitHub account that owns the repository you want to sync with:",
                    choices: choices,
                }).catch((err: Error) => {
                    if (err.message.includes('User force closed the prompt with SIGINT')) {
                        console.log('Operation canceled');
                        return process.exit(0);
                    } else {
                        console.error(err.message);
                        return process.exit(1);
                    }
                });

                sync.git_user = namePrompt.answer;
            }
        }

        const existingUser: UserConf | undefined = configManager.get(`users.${sync.git_user}`);
        if(!existingUser || !existingUser.token) {
            console.log(`Github account "${sync.git_user}" not found in configuration\nPlease add it using the config command (git-synchronizer config --add-user)`);
            return process.exit(1);
        } else {
            sync.token = existingUser.token;
        }
        
        // Check if "repository" argument is set or ask for it
        if(!cmd.args[1]) {
            const repoPrompt: { answer: string } = await inquirer.prompt({
                type: "input",
                name: "answer",
                message: "Enter the GitHub repository name to sync with:",
            }).catch((err: Error) => {
                if (err.message.includes('User force closed the prompt with SIGINT')) {
                    console.log('Operation canceled');
                    return process.exit(0);
                } else {
                    console.error(err.message);
                    return process.exit(1);
                }
            });

           
           sync.repository = repoPrompt.answer;
           config.repositories[sync.repository] = config.repositories['unknown'];

           delete(config.repositories['unknown']);
        }

        const repoUrl = `https://api.github.com/repos/${sync.git_user}/${sync.repository}`
        const fetchRepo: Response = await fetch(repoUrl, {
            headers: {
                'Authorization': `token ${sync.token}`
            }
        }).catch((err: Error) => {
            console.error(`An error occured while fetching the repo: ${err.message}`);
            return process.exit(1);
        });

        if (!fetchRepo.ok) {
            console.error(`The GitHub account "${sync.git_user}" does not have a repository named "${sync.repository}".`);
            return process.exit(1);
        } else {
            sync.url = `https://${sync.token}@github.com/${sync.git_user}/${sync.repository}.git`;
        }

        // Check if "branch" argument is set or ask for it
        if(!cmd.args[2]) {
            const branchPrompt: { answer: string } = await inquirer.prompt({
                type: "input",
                name: "answer",
                message: "Enter the branch name to sync with (default: main):",
            }).catch((err: Error) => {
                if (err.message.includes('User force closed the prompt with SIGINT')) {
                    console.log('Operation canceled');
                    return process.exit(0);
                } else {
                    console.error(err.message);
                    return process.exit(1);
                }
            });

            sync.branch = branchPrompt.answer || "main";
        }

        const fetchBranch: Response = await fetch(`${repoUrl}/branches/${sync.branch}`, {
            headers: {
                'Authorization': `token ${sync.token}`
            }
        }).catch((err: Error) => {
            console.error(`An error occured while fetching the branch: ${err.message}`);
            return process.exit(1);
        });

        if (!fetchBranch.ok) {
            console.error(`The GitHub repository "${sync.git_user}/${sync.repository}" does not have a branch named "${sync.branch}".`);
            return process.exit(1);
        }

        // Check if "folder" argument is set or ask for it
        if(!cmd.args[3]) {
            const pathPrompt: { answer: string } = await inquirer.prompt({
                type: "input",
                name: "answer",
                message: `Enter the path to the folder to sync with (default: ${process.cwd()}):`,
            }).catch((err: Error) => {
                if (err.message.includes('User force closed the prompt with SIGINT')) {
                    console.log('Operation canceled');
                    return process.exit(0);
                } else {
                    console.error(err.message);
                    return process.exit(1);
                }
            });

            repoSync.folder = pathPrompt.answer || process.cwd();
        }

        if(!fs.existsSync(repoSync.folder as string)) {
            console.error(`The folder was not found at "${repoSync.folder}".`);
            return process.exit(1);
        }

        // Check if "os_user" argument is set or ask for it
        if(!cmd.args[4]) {
            if(os.platform() === "win32") {
                repoSync.os_user = os.userInfo().username;
                return;
            }

            const userPrompt: { answer: string } = await inquirer.prompt({
                type: "input",
                name: "answer",
                message: `Enter the name of the OS user who will have the permissions in the "folder" and who will perform the "post-install" command (default: ${os.userInfo().username}):`,
            }).catch((err: Error) => {
                if (err.message.includes('User force closed the prompt with SIGINT')) {
                    console.log('Operation canceled');
                    return process.exit(0);
                } else {
                    console.error(err.message);
                    return process.exit(1);
                }
            });

            repoSync.os_user = userPrompt.answer || os.userInfo().username;
        }

        // Check if "action" argument is set or ask for it
        if(!cmd.args[6]) {
            const typePrompt: { answer: keyof RepoConf } = await inquirer.prompt({
                type: "list",
                name: "answer",
                message: "Choose the action that should trigger a sync:",
                choices: ["push", "workflow_run", "release"],
                default: "push",
            }).catch((err: Error) => {
                if (err.message.includes('User force closed the prompt with SIGINT')) {
                    console.log('Operation canceled');
                    return process.exit(0);
                } else {
                    console.error(err.message);
                    return process.exit(1);
                }
            });

            sync.action = typePrompt.answer;
        }

        // Check if "post-install" argument is set or ask for it
        if(!cmd.args[6]) {
            const cmdPrompt: { answer: string } = await inquirer.prompt({
                type: "list",
                name: "answer",
                message: "Choose a command to execute after sync (example: 'sh myfile.sh' if you choose 'custom'):",
                choices: ["npm install", "composer install", "custom", "none"],
                default: "none",
            }).catch((err: Error) => {
                if (err.message.includes('User force closed the prompt with SIGINT')) {
                    console.log('Operation canceled');
                    return process.exit(0);
                } else {
                    console.error(err.message);
                    return process.exit(1);
                }
            });

            if(cmdPrompt.answer === "custom") {
                const customCmdPrompt: { answer: string } = await inquirer.prompt({
                    type: "input",
                    name: "answer",
                    message: "Enter the custom command to execute (example: 'sh myfile.sh'):",
                }).catch((err: Error) => {
                    if (err.message.includes('User force closed the prompt with SIGINT')) {
                        console.log('Operation canceled');
                        return process.exit(0);
                    } else {
                        console.error(err.message);
                        return process.exit(1);
                    }
                });

                repoSync.postcmd = customCmdPrompt.answer;
            } else {
                repoSync.postcmd = cmdPrompt.answer;
            }
        }

        console.log("Configuring the sync folder, please wait...");

        const existingRepo: RepoConf | undefined = configManager.get(`users.${sync.git_user}.repositories.${sync.repository}`);

        if(!existingRepo){
            configManager.set(`users.${sync.git_user}.repositories.${sync.repository}`, config.repositories[sync.repository]);
        }

        switch (sync.action) {
            case "push":
                config.repositories[sync.repository].push = repoSync;
                configManager.set(`users.${sync.git_user}.repositories.${sync.repository}.push`, config.repositories[sync.repository].push);
                break;
            case "workflow_run":
                config.repositories[sync.repository].workflow_run = repoSync;
                configManager.set(`users.${sync.git_user}.repositories.${sync.repository}.workflow_run`, config.repositories[sync.repository].workflow_run);
                break;
            case "release":
                config.repositories[sync.repository].release = repoSync;
                configManager.set(`users.${sync.git_user}.repositories.${sync.repository}.release`, config.repositories[sync.repository].release);
                break;
            default:
                break;
        }
        
        if(configManager.get(`users.${sync.git_user}.repositories.${sync.repository}.${sync.action}`) && configManager.get(`users.${sync.git_user}.repositories.${sync.repository}.${sync.action}.folder`) === repoSync.folder){
            console.log("Sync folder configured successfully.");
            return process.exit(0);
        }

        if (fs.existsSync(path.join(repoSync.folder as string, ".git"))) {
            console.error(`The folder ${repoSync.folder} is already synced with a git repository.`);
            configManager.delete(`users.${sync.git_user}.repositories.${sync.repository}.${sync.action}`);
            return process.exit(1);
        }

        const commandPrefix: string = os.platform() === "win32" ? "" : `sudo -u ${repoSync.os_user} `;
        const chownFolder: string = os.platform() === "win32" ? "" : `chown -R ${repoSync.os_user}:${repoSync.os_user} ${repoSync.folder} && `;
        let command: string = `${chownFolder}cd ${repoSync.folder}`;

        if(sync.action === "push") {
            command = `${command} && ${commandPrefix}git init -b ${sync.branch} && ${commandPrefix}git remote add origin ${sync.url} && ${commandPrefix}git pull origin ${sync.branch} && ${commandPrefix}git branch --set-upstream-to=origin/${sync.branch} ${sync.branch} &&${commandPrefix}git pull`;
        }

        const exe: ChildProcess = exec(command, (error, stdout, stderr): void => {
            if (error) {
                console.error(error.message);
                return process.exit(1);
            }

            if (stderr) {
                console.error(stderr);
                return process.exit(1);
            }
        });

        // Handle child process exit
        exe.on("exit", async (code: number) => {
            if (code === 0) {
                const url: string = `https://api.github.com/repos/${sync.git_user}/${sync.repository}/hooks`;
                const webhook: Webhook = {
                    name: "web",
                    active: true,
                    events: [sync.action],
                    config: {
                        url: `${configManager.get("server.address")}:${configManager.get("server.port")}`,
                        content_type: "json",
                        insecure_ssl: 0,
                        secret: repoSync.secret as string,
                    }
                }
                
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                    "Authorization": `Bearer ${sync.token}`,
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                    },
                    body: JSON.stringify(webhook),
                });

                if (!response.ok) {
                    console.log(`Failed to create webhook for repository ${sync.git_user}/${sync.repository}: ${response.statusText}`);
                    console.log("Sync folder configured, but you must set up the webhook manually.")
                } else {
                    const data = await response.json();
                    
                    configManager.set(`users.${sync.git_user}.repositories.${sync.repository}.${sync.action}.hook_id`, data.id)
                    console.log("Sync folder configured successfully.");
                }
            } else {
                configManager.delete(`users.${sync.git_user}.repositories.${sync.repository}.${sync.action}`);
            }
        }); 
    }
}
