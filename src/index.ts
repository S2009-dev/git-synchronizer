import { Command } from "commander";
import { Package } from "./utils/types";
import registerCommands from "./utils/registerCommands";

/**
 * Registers all commands and parse the program arguments with commander.
 * 
 * @remarks This the main function so there isn't any arg or return value.
 */
async function main(): Promise<void> {
    const packageJson: Package = require("../package.json");
    const repositoryUrl: string = "https://github.com/S2009-dev/git-synchronizer";
    const program: Command = new Command();

    program
        .name(packageJson.name)
        .version(packageJson.version, '-v, --version')
        .description(packageJson.description)
        .addHelpText("afterAll", `\nS2009's Website: ${packageJson.homepage}\nRepository: ${repositoryUrl}\nDocumentation: ${repositoryUrl}/wiki`)
        .action((): void => {
            program.help();
        })

    const registeredCommands: Command[] = await registerCommands();

    for (const command of registeredCommands) {
        program.addCommand(command);
    }

    program.parse(process.argv);
}

main();