import fs from 'fs/promises'
import path from 'path'
import { CmdConf } from './types';
import { Command } from 'commander';

/**
 * Get the list of commands to register from the commands folder.
 * Add the action callback to each command.
 * @returns Array of commands to register.
 * @see Command
 */
export default async (): Promise<Command[]> => {
    const commandsFolder: string = path.join(__dirname, 'commands');
    const commandFiles: string[] = await fs.readdir(commandsFolder);
    const commands: Command[] = [];
    
    for (const file of commandFiles) {
        const cmdConf: CmdConf = require(path.join(commandsFolder, file)).default;
        const command: Command = cmdConf.cmd;

        command.action(async (options: any): Promise<void> => {
            await cmdConf.callback(command, options);
        });

        commands.push(command);
    }

    return commands;
}