import Conf from 'conf';
import yaml from 'js-yaml';

/**
 * Configuration manager for the application.
 * 
 * @requires conf
 * @requires js-yaml
 * 
 * @returns Configuration manager.
 */
export default new Conf({
    projectName: 'fr.s2009.git',
    projectSuffix: 'synchronizer',
    fileExtension: 'yaml',
	serialize: yaml.dump,
	deserialize: yaml.load,
    schema: {
        server: {
            type: 'object',
            properties: {
                port: { type: 'number' },
            }
        },
        users: {
            type: 'object',
            propertyNames: { type: 'string' },
            properties: {
                token: { type: 'string' },
                secret: { type: 'string' },
                repositories: { 
                    type: 'object',
                    propertyNames: { type: 'string' },
                    properties: {
                        push: { 
                            type: 'object',
                            properties: {
                                folder: { type: 'string' },
                                os_user: { type: 'string' },
                                postcmd: { type: 'string' },
                            }
                        },
                        release: { 
                            type: 'object',
                            properties: {
                                folder: { type: 'string' },
                                dl_filename: { type: 'string' },
                                os_user: { type: 'string' },
                                postcmd: { type: 'string' },
                            }
                        },
                        workflow_run: { 
                            type: 'object',
                            properties: {
                                folder: { type: 'string' },
                                dl_filename: { type: 'string' },
                                os_user: { type: 'string' },
                                postcmd: { type: 'string' },
                            }
                        }
                    }
                }
            }
        }
    }
});