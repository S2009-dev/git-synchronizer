/**
 * Important informations of the package.json file.
 */
export type Package = {
    name: string;
    description: string;
    version: string;
    homepage: string;
}

/**
 * Structure of a command file.
 * @requires commander
 */
export type CmdConf = {
    cmd: import('commander').Command;
    callback: (cmd: import('commander').Command, options: any) => Promise<void>;
}

/**
 * Structure of the server configuration in the config file.
 */
export type ServerConf = {
    port: number;
}

/**
 * Structure of a repository sync configuration in the config file.
 */
export type RepoSyncConf = {
    folder?: string; 
    user?: string; 
    postcmd?: string
}

/**
 * Structure of a repository actions configuration in the config file.
 * @requires RepoSyncConf
 */
export type RepoConf = {
    commits: RepoSyncConf;
    releases: RepoSyncConf;
}

/**
 * Structure of a user configuration in the config file.
 * @requires RepoConf
 */
export type UserConf = {
    token?: string;
    secret?: string;
    repositories: {
        [name: string]: RepoConf
    };
}

/**
 * Structure of the config file.
 * @requires ServerConf
 * @requires UserConf
 */
export type Config = {
    server: ServerConf;
    users: {
        [username: string]: UserConf;
    };
}

/**
 * Options for the config command.
 */
export type ConfigOptions = {
    open?: boolean;
    server?: number;
    addUser?: boolean | string[];
    removeUser?: string;
    removeSync?: boolean | string[];
}

/**
 * Options for the serve command.
 */
export type ServeOptions = {
    port?: number;
}

/**
 * Structure of a presync config for the init command.
 */
export type SyncConf = {
    url?: string;
    branch: string;
    name: string;
    username: string;
    token?: string;
    type: string;
}

/**
 * Structure of the algorithm used to verify the signature.
 * @see https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
 */
export type VerifAlgo = {
    name: string;
    hash: {
        name: string;
    }
}