import { Command } from "commander";
import { ConfigOptions, RepoConf, UserConf } from "../utils/types";
import inquirer from "inquirer";
import configManager from "../utils/configManager";
import { exec, spawn } from "child_process";
import fs from "fs";
import os from "os";

/**
 * Command to configure the Synchronizer.
 * @returns Command object and callback function.
 * @see Command
 * @see ConfigOptions
 * @see RepoConf
 * @see UserConf
 * @see inquirer
 * @see configManager
 * @see spawn
 */
export default {
    cmd: new Command()
        .name("config")
        .description("Configure the Synchronizer")
        .option("-o, --open", "Open the configuration file")
        .option("-s, --server [port]", "Set the server port ([number] default: 3000)", parseInt)
        .option("--add-user [userinfos...]", "Add a new GitHub user to the configuration ([username] [token] [secret])")
        .option("--remove-user [username]", "Remove a GitHub user from the configuration")
        .option("--remove-sync [syncinfos...]", "Remove a synced repository from the configuration ([username] [repo-name])"),

    callback: async (cmd: Command, options: ConfigOptions): Promise<void> => {
        if(options.open){
            if(os.platform() === "win32") {
                exec(`notepad "${configManager.path}"`);
            } else {
                spawn("nano", [configManager.path], { stdio: "inherit", shell: true });
            }
        } else if(options.server) {
            if(typeof options.server === "number") {
                const confirm: { answer: boolean } = await inquirer.prompt({
                    type: "confirm",
                    name: "answer",
                    message: `Are you sure you want to set the server port to ${options.server}?`,
                    default: false,
                }).catch((err: Error) => {
                    if (err.message.includes('User force closed the prompt with SIGINT')) {
                        console.log('Operation canceled');
                        return process.exit(0);
                    } else {
                        console.error(err.message);
                        return process.exit(1);
                    }
                });

                if(confirm.answer) {
                    configManager.set("server.port", options.server);
                    console.log(`Server port set to ${options.server}`);                    
                } else {
                    console.log("Operation canceled");
                }
            } else {
                console.log(`Server port is currently set to ${configManager.get("server.port") || 3000}`);
                
                const confirm: { answer: boolean } = await inquirer.prompt({
                    type: "confirm",
                    name: "answer",
                    message: "Do you want to change the server port?",
                    default: false,
                }).catch((err: Error) => {
                    if (err.message.includes('User force closed the prompt with SIGINT')) {
                        console.log('Operation canceled');
                        return process.exit(0);
                    } else {
                        console.error(err.message);
                        return process.exit(1);
                    }
                });

                if(confirm.answer) {
                    const portPrompt: { answer: number } = await inquirer.prompt({
                        type: "number",
                        name: "answer",
                        message: "Enter the new server port:",
                    }).catch((err: Error) => {
                        if (err.message.includes('User force closed the prompt with SIGINT')) {
                            console.log('Operation canceled');
                            return process.exit(0);
                        } else {
                            console.error(err.message);
                            return process.exit(1);
                        }
                    });

                    configManager.set("server.port", portPrompt.answer);
                    console.log(`Server port set to ${portPrompt.answer}`);
                } else {
                    console.log("Operation canceled");
                }
            }
        } else if(options.addUser) {
            const userinfos = options.addUser as string[];
            let username: string = userinfos[0] || "";
            let token: string = userinfos[1] || "";
            let secret: string = userinfos[2] || "";

            if(!username){
                const namePrompt: { answer: string } = await inquirer.prompt({
                    type: "input",
                    name: "answer",
                    message: "Enter the GitHub username:",
                }).catch((err: Error) => {
                    if (err.message.includes('User force closed the prompt with SIGINT')) {
                        console.log('Operation canceled');
                        return process.exit(0);
                    } else {
                        console.error(err.message);
                        return process.exit(1);
                    }
                });

                username = namePrompt.answer;
            }

            const existingUser: UserConf | undefined = configManager.get(`users.${username}`);

            if(existingUser) return console.log(`User ${username} already exists in the configuration`);
            if(!token){
                const tokenPrompt: { answer: string } = await inquirer.prompt({
                    type: "input",
                    name: "answer",
                    message: "Enter the GitHub access token:",
                }).catch((err: Error) => {
                    if (err.message.includes('User force closed the prompt with SIGINT')) {
                        console.log('Operation canceled');
                        return process.exit(0);
                    } else {
                        console.error(err.message);
                        return process.exit(1);
                    }
                });

                token = tokenPrompt.answer;
            }

            if(!secret){
                const secretPrompt: { answer: string } = await inquirer.prompt({
                    type: "input",
                    name: "answer",
                    message: "Enter the Webhook secret:",
                }).catch((err: Error) => {
                    if (err.message.includes('User force closed the prompt with SIGINT')) {
                        console.log('Operation canceled');
                        return process.exit(0);
                    } else {
                        console.error(err.message);
                        return process.exit(1);
                    }
                });

                secret = secretPrompt.answer;
            }

            const confirm: { answer: boolean } = await inquirer.prompt({
                type: "confirm",
                name: "answer",
                message: `Are you sure you want to add this user to the configuration?\nUsername: ${username}\nToken: ${token}\nSecret: ${secret}\n`,
                default: false,
            }).catch((err: Error) => {
                if (err.message.includes('User force closed the prompt with SIGINT')) {
                    console.log('Operation canceled');
                    return process.exit(0);
                } else {
                    console.error(err.message);
                    return process.exit(1);
                }
            });

            if(confirm.answer) {
                configManager.set(`users.${username}`, { token, secret, repositories: {} });
                console.log(`User ${username} added to configuration`);
            } else {
                console.log("Operation cancelled");
            }
        } else if(options.removeUser) {
            let username: string = options.removeUser;

            if(!configManager.get("users")) {
                console.log("No GitHub accounts found in configuration");
                return process.exit(0);
            }

            if(typeof options.removeUser !== "string") {
                const choices: string[] = Object.keys(configManager.get("users"));

                if(choices.length === 0) {
                    console.log("No GitHub accounts found in configuration");
                    return process.exit(0);
                }

                const namePrompt: { answer: string } = await inquirer.prompt({
                    type: "list",
                    name: "answer",
                    message: "Select the account to remove from the configuration:",
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

                username = namePrompt.answer;
            }

            const existingUser: UserConf | undefined = configManager.get(`users.${username}`);

            if(existingUser) {
                const confirm: { answer: boolean } = await inquirer.prompt({
                    type: "confirm",
                    name: "answer",
                    message: `Are you sure you want to remove ${username} from the configuration?\n`,
                    default: false,
                }).catch((err: Error) => {
                    if (err.message.includes('User force closed the prompt with SIGINT')) {
                        console.log('Operation canceled');
                        return process.exit(0);
                    } else {
                        console.error(err.message);
                        return process.exit(1);
                    }
                });

                if(confirm.answer) {
                    configManager.delete(`users.${username}`);
                    console.log(`User ${username} removed from configuration`);
                } else {
                    console.log("Operation cancelled");
                }
            } else {
                console.log(`User ${username} not found in configuration`);
            }
        } else if(options.removeSync) {
            const syncinfos = options.removeSync as string[];
            let username: string = syncinfos[0] || "";
            let repoName: string = syncinfos[0] || "";

            if(!configManager.get("users")) {
                console.log("No GitHub accounts found in configuration");
                return process.exit(0);
            }
            
            if(!username){
                const choices: string[] = Object.keys(configManager.get("users"));

                if(choices.length === 0) {
                    console.error("No GitHub accounts found in configuration");
                    return process.exit(0);
                } else if(choices.length === 1) {
                    console.log(`Selecting the only GitHub account: ${choices[0]}`);
                    username = choices[0];
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

                    username = namePrompt.answer;
                }
            }

            const existingUser: UserConf | undefined = configManager.get(`users.${username}`);
            
            if(!existingUser) return console.log(`The user ${username} does not exist in the configuration`);        
            if(!configManager.get(`users.${username}.repositories`)) {
                console.log(`No repositories found for user ${username} in configuration`);
                return process.exit(0);
            }

            if(!repoName){
                const choices: string[] = Object.keys(configManager.get(`users.${username}.repositories`));

                if(choices.length === 0) {
                    console.log(`No repositories found for user ${username} in configuration`);
                    return process.exit(0);
                } else if(choices.length === 1) {
                    console.log(`Selecting the only GitHub repository: ${choices[0]}`);
                    repoName = choices[0];
                } else {
                    const repoPrompt: { answer: string } = await inquirer.prompt({
                        type: "list",
                        name: "answer",
                        message: "Select your GitHub repository:",
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

                    repoName = repoPrompt.answer.toLowerCase();
                }
            }

            const existingRepo: RepoConf | undefined = configManager.get(`users.${username}.repositories.${repoName}`);
            if(!existingRepo) return console.log(`The repository ${repoName} for user ${username} does not exist in the configuration`);

            const typePrompt: { answer: string } = await inquirer.prompt({
                type: "list",
                name: "answer",
                message: "Choose what type of sync should be removed:",
                choices: ["commits", "releases", "both"],
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

            const type: string = typePrompt.answer;
            const confirm: { answer: boolean } = await inquirer.prompt({
                type: "confirm",
                name: "answer",
                message: `Are you sure you want to remove this sync from the configuration?\nUsername: ${username}\nRepository: ${repoName}\nType: ${type}\n`,
                default: false,
            }).catch((err: Error) => {
                if (err.message.includes('User force closed the prompt with SIGINT')) {
                    console.log('Operation canceled');
                    return process.exit(0);
                } else {
                    console.error(err.message);
                    return process.exit(1);
                }
            });

            let folder: string | undefined;
            let commits: string | undefined;
            let releases: string | undefined;

            if (type !== "both"){
                folder = configManager.get(`users.${username}.repositories.${repoName}.${type}.folder`);
            } else {
                commits = configManager.get(`users.${username}.repositories.${repoName}.commits.folder`);
                releases = configManager.get(`users.${username}.repositories.${repoName}.releases.folder`);
            }

            if(confirm.answer) {
                if (type !== "both"){
                    configManager.delete(`users.${username}.repositories.${repoName}.${type}`);
                    console.log(`Sync with repository ${username}/${repoName} removed from configuration`);
                    
                    if(folder && fs.existsSync(folder as string)){
                        const confirm: { answer: boolean } = await inquirer.prompt({
                            type: "confirm",
                            name: "answer",
                            message: `Do you also want to remove the synced folder ? (${folder})\n`,
                            default: false,
                        }).catch((err: Error) => {
                            if (err.message.includes('User force closed the prompt with SIGINT')) {
                                console.log('Operation canceled');
                                return process.exit(0);
                            } else {
                                console.error(err.message);
                                return process.exit(1);
                            }
                        });

                        if(confirm.answer ) {
                            await fs.promises.rm(folder as string, { recursive: true, force: true });
                            console.log(`Folder ${folder} removed`);
                        }
                    }

                    console.log("Operation completed");
                } else {
                    configManager.delete(`users.${username}.repositories.${repoName}`);
                    console.log(`Sync with repository ${username}/${repoName} removed from configuration`);

                    if(commits && fs.existsSync(commits as string)){
                        const confirm: { answer: boolean } = await inquirer.prompt({
                            type: "confirm",
                            name: "answer",
                            message: `Do you also want to remove the synced commits folder ? (${commits})\n`,
                            default: false,
                        }).catch((err: Error) => {
                            if (err.message.includes('User force closed the prompt with SIGINT')) {
                                console.log('Operation canceled');
                                return process.exit(0);
                            } else {
                                console.error(err.message);
                                return process.exit(1);
                            }
                        });

                        if(confirm.answer) {
                            await fs.promises.rm(commits as string, { recursive: true, force: true });
                            console.log(`Commits folder ${commits} removed`);
                        }
                    }

                    if(releases && fs.existsSync(releases as string)){
                        const confirm2: { answer: boolean } = await inquirer.prompt({
                            type: "confirm",
                            name: "answer",
                            message: `Do you also want to remove the releases synced folder ? (${releases})\n`,
                            default: false,
                        }).catch((err: Error) => {
                            if (err.message.includes('User force closed the prompt with SIGINT')) {
                                console.log('Operation canceled');
                                return process.exit(0);
                            } else {
                                console.error(err.message);
                                return process.exit(1);
                            }
                        });

                        if(confirm2.answer) {
                            await fs.promises.rm(releases as string, { recursive: true, force: true });
                            console.log(`Releases folder ${releases} removed`);
                        }
                    }

                    console.log("Operation completed");
                }
            } else {
                console.log("Operation cancelled");
            }
        } else {
            cmd.help();
        }
    }
}
