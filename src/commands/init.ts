import { Argument, Command } from "commander";
import inquirer from "inquirer";
import os from "os";
import configManager from "../utils/configManager";
import { RepoConf, RepoSyncConf, SyncConf, UserConf } from "../utils/types";
import { ChildProcess, exec } from "child_process";
import fs from "fs";
import path from "path";

/**
 * Command to initialize a synchronization with a GitHub repository in a folder.
 * @returns Command object and its callback.
 * @see Command
 * @see Argument
 * @see configManager
 * @see UserConf
 * @see RepoSyncConf
 */
export default {
    cmd: new Command()
        .name("init")
        .description("Sync a folder with a GitHub repository")
        .argument('[username]', 'GitHub account username to sync with')
        .argument('[repository]', 'GitHub repository name to sync with')
        .argument('[branch]', 'Branch to sync with', 'main')
        .argument('[path]', 'Path to the folder to sync', process.cwd())
        .argument('[user]', 'OS user who will run processes', os.userInfo().username)
        .addArgument(new Argument('[type]', 'When to sync').choices(['commit', 'release']).default('commit'))
        .addArgument(new Argument('[post-install]', 'Run a command after syncing').choices(['npm install', 'composer install', 'custom', 'none']).default('none')),

    callback: async (cmd: Command): Promise<void> => {
        const config: UserConf = {
            repositories: {
                [cmd.args[1] ?? "unknown"]: {
                    commits: {},
                    releases: {}
                }
            }
        };

        const repoSync: RepoSyncConf = {
            folder: cmd.args[3],
            user: cmd.args[4],
            postcmd: cmd.args[6]
        }

        const sync: SyncConf = {
            branch: cmd.args[2],
            name: cmd.args[1],
            username: cmd.args[0],
            type: cmd.args[5]
        };

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
                console.log(`Using the only GitHub account: ${choices[0]}`);
                sync.username = choices[0];
            } else {
                const namePrompt: { answer: string } = await inquirer.prompt({
                    type: "list",
                    name: "answer",
                    message: "Select your GitHub account:",
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

                sync.username = namePrompt.answer;
            }
        }

        const existingUser: UserConf | undefined = configManager.get(`users.${sync.username}`);
        if(!existingUser) {
            console.log(`User ${sync.username} not found in configuration\nPlease add it using the config command (git-synchronizer config --add-user)`);
            return process.exit(1);
        } else {
            sync.token = existingUser.token;
        }
        
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

           
           sync.name = repoPrompt.answer.toLowerCase();
           config.repositories[sync.name] = config.repositories['unknown'];

           delete(config.repositories['unknown']);
        }

        const repoUrl = `https://api.github.com/repos/${sync.username}/${sync.name}`
        const fetchRepo: Response = await fetch(repoUrl, {
            headers: {
                'Authorization': `token ${sync.token}`
            }
        }).catch((err: Error) => {
            console.error(err.message);
            return process.exit(1);
        });

        if (!fetchRepo.ok) {
            console.error(`The GitHub account ${sync.username} does not have a repository named ${sync.name}.`);
            return process.exit(1);
        } else {
            sync.url = `https://${sync.token}@github.com/${sync.username}/${sync.name}.git`;
        }

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
            console.error(err.message);
            return process.exit(1);
        });

        if (!fetchBranch.ok) {
            console.error(`The GitHub repository ${sync.username}/${sync.name} does not have a branch named ${sync.branch}.`);
            return process.exit(1);
        }

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

        if(!cmd.args[4]) {
            if(os.platform() === "win32") {
                repoSync.user = os.userInfo().username;
                return;
            }

            const userPrompt: { answer: string } = await inquirer.prompt({
                type: "input",
                name: "answer",
                message: `Enter the name of the OS user to run processes as (default: ${os.userInfo().username}):`,
            }).catch((err: Error) => {
                if (err.message.includes('User force closed the prompt with SIGINT')) {
                    console.log('Operation canceled');
                    return process.exit(0);
                } else {
                    console.error(err.message);
                    return process.exit(1);
                }
            });

            repoSync.user = userPrompt.answer || os.userInfo().username;
        }

        if(!cmd.args[5]) {
            const typePrompt: { answer: string } = await inquirer.prompt({
                type: "list",
                name: "answer",
                message: "Choose when sync should be triggered:",
                choices: ["commits", "releases"],
                default: "commits",
            }).catch((err: Error) => {
                if (err.message.includes('User force closed the prompt with SIGINT')) {
                    console.log('Operation canceled');
                    return process.exit(0);
                } else {
                    console.error(err.message);
                    return process.exit(1);
                }
            });

            sync.type = typePrompt.answer;
        }

        if(!cmd.args[6]) {
            const cmdPrompt: { answer: string } = await inquirer.prompt({
                type: "list",
                name: "answer",
                message: "Choose the command to execute after sync:",
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
                    message: "Enter the custom command to execute:",
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

        console.log("Configuring sync folder, please wait...");

        const existingRepo: RepoConf | undefined = configManager.get(`users.${sync.username}.repositories.${sync.name}`);

        if(!existingRepo){
            configManager.set(`users.${sync.username}.repositories.${sync.name}`, config.repositories[sync.name]);
        }

        if (sync.type === "commits") {
            config.repositories[sync.name].commits = repoSync;
            configManager.set(`users.${sync.username}.repositories.${sync.name}.commits`, config.repositories[sync.name].commits);

            if(configManager.get(`users.${sync.username}.repositories.${sync.name}.releases`) && configManager.get(`users.${sync.username}.repositories.${sync.name}.releases.folder`) === repoSync.folder){
                console.log("Sync folder configured successfully.");
                return process.exit(0);
            }
        } else {
            config.repositories[sync.name].releases = repoSync;
            configManager.set(`users.${sync.username}.repositories.${sync.name}.releases`, config.repositories[sync.name].releases);

            
            if(configManager.get(`users.${sync.username}.repositories.${sync.name}.commits`) && configManager.get(`users.${sync.username}.repositories.${sync.name}.commits.folder`) === repoSync.folder){
                console.log("Sync folder configured successfully.");
                return process.exit(0);
            }
        }

        if (fs.existsSync(path.join(repoSync.folder || "", ".git"))) {
            console.error(`The folder ${repoSync.folder} is already synced with a git repository.`);
            configManager.delete(`users.${sync.username}.repositories.${sync.name}.${sync.type}`);
            return process.exit(1);
        }

        const commandPrefix: string = os.platform() === "win32" ? "" : `sudo -u ${repoSync.user} `;
        const chownFolder: string = os.platform() === "win32" ? "" : `chown -R ${repoSync.user}:${repoSync.user} ${repoSync.folder} && `;
        const command: string = `${chownFolder}cd ${repoSync.folder} && ${commandPrefix}git init -b ${sync.branch} && ${commandPrefix}git remote add origin ${sync.url} && ${commandPrefix}git pull origin ${sync.branch} && ${commandPrefix}git branch --set-upstream-to=origin/${sync.branch} ${sync.branch} &&${commandPrefix}git pull`;
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

        exe.on("exit", (code: number) => {
            if (code === 0) {
                console.log("Sync folder configured successfully.");
            } else {
                configManager.delete(`users.${sync.username}.repositories.${sync.name}.${sync.type}`);
            }
        }); 
    }
}
