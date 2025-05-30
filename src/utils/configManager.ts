import Conf from 'conf';
import yaml from 'js-yaml';

/**
 * Configuration manager for the application.
 * @returns Configuration manager.
 * @see Conf
 * @see yaml
 * @see https://www.npmjs.com/package/conf
 * @see https://www.npmjs.com/package/js-yaml
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
                        commits: { 
                            type: 'object',
                            properties: {
                                folder: { type: 'string' },
                                user: { type: 'string' },
                                postcmd: { type: 'string' },
                            }
                        },
                        releases: { 
                            type: 'object',
                            properties: {
                                folder: { type: 'string' },
                                user: { type: 'string' },
                                postcmd: { type: 'string' },
                            }
                        }
                    }
                }
            }
        }
    }
});