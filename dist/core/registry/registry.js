"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _promise = require("babel-runtime/core-js/promise");

var _promise2 = _interopRequireDefault(_promise);

var _from = require("babel-runtime/core-js/array/from");

var _from2 = _interopRequireDefault(_from);

require("source-map-support/register");

var _path = require("path");

var _path2 = _interopRequireDefault(_path);

var _isMain = require("../isMain");

var _isMain2 = _interopRequireDefault(_isMain);

var _module = require("./module");

var _module2 = _interopRequireDefault(_module);

var _requestPath = require("./requestPath");

var _requestPath2 = _interopRequireDefault(_requestPath);

var _settingsHandler = require("../communication/data/settings/settingsHandler");

var _settingsHandler2 = _interopRequireDefault(_settingsHandler);

var _windowHandler = require("../window/windowHandler");

var _windowHandler2 = _interopRequireDefault(_windowHandler);

var _channelHandler = require("../communication/channel/channelHandler");

var _channelHandler2 = _interopRequireDefault(_channelHandler);

var _IPC = require("../communication/IPC");

var _IPC2 = _interopRequireDefault(_IPC);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const defaultModuleData = {
    location: {
        window: 1,
        section: 0
    }
};

/**
 * @typedef {Object} Registry~Request
 * @property {string} type - The type of handeling you are requesting
 * @property {('all'|'one'|'function')} [use] - What modules to use to answer the request
 * @property {Object} [data] - Any extra data you want to pass that modules can use to determine if they can answer the request
 * @property {Module} [source] - The module that sent out the request (can be left out when usimg Module.requestHandle)
 * @property {Object} [methods] - Extra methods that can get called by the handle (is only used by Module.requestHandle)
 */

/**
 * @typedef {Object} Registry~Requestlistener
 * @property {string} type - The type of request to handle
 * @property {Object[]} listeners - The modules that can answer this request
 * @property {Class<Module>} listeners[].module - The module class that can answer the request
 * @property {function} listeners[].filter - The filter to make sure the class can handle this request
 */

/**
 * @classdesc A class to track all the modules, and handle module requests
 * @class
 * @hideconstructor
 */
class Registry {
    /**
     * Request modules to handle the passed data and establish a connection with these modules
     * @param  {Request} request - The information on how to handle the data
     * @return {Promise<ChannelSender[]>} The channel(s) that have been created to answer the request
     * @async
     * @public
     */
    static requestHandle(request) {
        if (!request.use || typeof request.use == "string" || !request.use.match(/^(one|all)$/g)) request.use = "one";
        if (request.source instanceof _module2.default) request.source = request.source.getPath().toString(true);
        return this.__request([request], "handle");
    }

    /**
     * Request module classes of a specific type
     * @param {Request} request - The information on what module to get
     * @returns {(Class<Module>|Array<Class<Module>>)} The module(s) that it could find with the specified type
     * @public
     */
    static requestModule(request) {
        var requests = (0, _from2.default)(arguments);

        // Normalize the request format
        var requests = requests.map(request => {
            if (typeof request == "string") request = { type: request };
            if (!request.use || typeof request.use == "string" || !request.use.match(/^(one|all)$/g)) request.use = "one";
            return request;
        });

        // Retrieve the request modules
        const requestsModules = this.__request(requests, "module", true);

        // Format the response appropriately
        if (requestsModules.length > 1) {
            const response = {};

            // Map the modules to their request types
            for (let i = 0; i < requestsModules.length; i++) {
                const requestType = requests[i].type;
                response[requestType] = requestsModules[i];
            }

            return response;
        } else {
            // Directly return the modules from the only request
            return requestsModules[0];
        }
    }

    // Protected methods
    /**
     * Loads a module at the specified path relative to the modules folder
     * @param {string} path - The path to the module class
     * @returns {Class<Module>} The module class
     * @protected
     */
    static _loadModule(path) {
        if (!this.moduleClasses[path]) {
            // Require module
            const data = require(this.__getModulesPath(path));

            // Verify all necessary data is passed
            if (data) {
                const clas = data.default;
                const config = data.config;
                if (config) {
                    // Augment data with some variables that can be extracted
                    clas.modulePath = path;
                    config.module = clas;

                    // Register the module itself
                    this.moduleClasses[path] = data;

                    // Add listener to the list of listeners for this request type
                    const listeners = this.__getListeners(config.type);
                    listeners.listeners.push(config);
                } else {
                    return data;
                }
            }
        }
        return this.moduleClasses[path];
    }
    /**
     * Loads all the modules
     * @returns {Array<Class<Module>>} All the module classes that have been loaded
     * @protected
     */
    static _loadAllModules() {}
    //TODO: make a module loader


    /**
     * Registeres the module so the registry knows of its existence
     * @param {Module} moduleInstance - The module to register
     * @returns {number} The unique ID that the module instance has now been assigned
     * @async
     * @protected
     */
    static async _registerModuleInstance(moduleInstance) {
        // Store the instance in this module/process
        this.moduleInstances.push(moduleInstance);

        // Set the proper ID for the request path
        const requestPath = moduleInstance.getPath();
        const ID = (await _IPC2.default.send("Registry.registerModuleInstance", {
            requestPath: requestPath.toString(true)
        }, 0))[0];
        requestPath.getModuleID().ID = ID;
        return ID;
    }

    /**
     * Deregisters the module so the registry knows it is no longer used
     * @param {Module} moduleInstance - The module to deregister
     * @returns {undefined}
     * @async
     * @protected
     */
    static async _deregisterModuleInstance(moduleInstance) {
        // Remove the module path in the main process
        const requestPath = moduleInstance.getPath();
        await _IPC2.default.send("Registry.deregisterModuleInstance", {
            requestPath: requestPath.toString(true)
        }, 0);

        // Remove the instance from this module/process
        const index = this.moduleInstances.indexOf(moduleInstance);
        if (index !== -1) this.moduleInstances.splice(index, 1);
        if (this.moduleInstances.length == 0) _windowHandler2.default._close();
    }

    /**
     * Returns the amount of modules that are currently registered
     * @returns {number} The amount of modules are currently registered
     * @protected
     */
    static _getModuleInstanceCount() {
        return this.moduleInstances.length;
    }

    // Private methods
    /**
     * Creates an object to store what classes can answer a certain request type if it hasn't been created already, and returns it
     * @param {String} type - The request type to return the object of
     * @returns {Registry~Requestlistener} An object that tracks the listeners for a certain request type
     * @private
     */
    static __getListeners(type) {
        // Create listeners type variable if not available
        if (!this.listeners[type]) this.listeners[type] = {
            type: type,
            listeners: []
        };

        // Return listener type
        return this.listeners[type];
    }

    /**
     * Returns the relative path from this class to the modules directory
     * @param {String} [path=""] - The path to append to the modules directory
     * @returns {String} The relative path to the directory
     * @private
     */
    static __getModulesPath(path = "") {
        return _path2.default.join("..", "..", "modules", path);
    }

    /**
     * Retrieves the modules that can handle the passed request
     * @param {Registry~Request} request - The request to find module classes for
     * @returns {(Class<Module>|Array<Class<Module>>)} The module classes that have been chosen to handle the request
     * @private
     */
    static __getModules(request) {
        // Get the module listeners to handle this type of request
        const listenerType = this.__getListeners(request.type);

        // Map modules with their priority to this particular request
        const priorities = listenerType.listeners.map(listener => {
            return {
                priority: listener.filter(request),
                module: listener.module
            };
        }).filter(priority => priority.priority > 0);

        // Sort the results
        priorities.sort((a, b) => b.priority - a.priority);

        // Determine what modules to return
        if (request.use == "all") {
            return priorities.map(a => a.module);
        } else if (typeof request.use == "Function") {
            return priorities.filter(request.use).map(a => a.module);
        } else {
            return priorities[0] && priorities[0].module;
        }
    }

    /**
     * Finishes the request by serving the correct data based on the module classes that were found
     * @param {('module'|'handle')} type - The type of request that was made (either to handle data, or to get modules)
     * @param {Registry~Request[]} requests - The requests that are being finished (only contains 1 if type=='handle')
     * @param {Array<Array<Class<Module>>>} requestsModules - The modules that are found to match each request
     * @returns {(Promise<Array<Array<Class<Module>>>>|Promise<ChannelSender[]>|Promise<ChannelSender>)} The data that the request results in
     * @async
     * @private
     */
    static async __finishRequest(type, requests, requestsModules) {
        // Resolve request by simply returning the module if it was a module request,
        //      or instanciate a module and return a channel on a handle request
        if (type == "module") {
            return requestsModules;
        } else if (type == "handle") {
            // The handle type only permits 1 request to exist
            let requestModules = requestsModules[0];
            const request = requests[0];

            // In order to batch the await, instead of waiting between each open instance request
            const instantiatePromises = [];

            if (!(requestModules instanceof Array)) requestModules = [requestModules];

            // Go through modules for 1 request
            requestModules.forEach(module => {
                try {
                    // Create the proper request path
                    let source;
                    if (request.source) {
                        source = new _requestPath2.default(request.source).augmentPath(module);
                    } else {
                        source = new _requestPath2.default(module);
                    }

                    // Attempt to retrieve the correct startup settings
                    let moduleData = _settingsHandler2.default._getModuleFile(source);
                    if (!moduleData) moduleData = _settingsHandler2.default._getModuleFile(new _requestPath2.default(module));
                    if (!moduleData) moduleData = defaultModuleData;

                    // Open the window that the module should appear in
                    instantiatePromises.push(_windowHandler2.default.openModuleInstance(moduleData, request, module.toString()));
                } catch (e) {
                    console.error(`Something went wrong while trying to instantiate ${module}: `, e);
                }
            });

            // Return all the created channels once ready
            const channels = await _promise2.default.all(instantiatePromises);

            if (request.use == "one") {
                return channels[0];
            } else {
                return channels.filter(channel => channel); // Remove failed instanciations
            }
        }
    }

    /**
     * Handles one or more requests and serves the responses
     * @param {Registry~Request[]} requests - The requests to make
     * @param {('module'|'handle')} type - The type of request that was made (either to handle data, or to get modules)
     * @param {boolean} synced - Whether or not to request data synchronously (can only be synced if type=='module')
     * @returns {(Promise<Array<Array<Class<Module>>>>|Promise<ChannelSender[]>|Promise<ChannelSender>)} The data that the request results in
     * @private
     */
    static __request(requests, type, synced) {
        if (synced) {
            if (_isMain2.default) {
                // Directly resolve the request as we have access to all modules
                return requests.map(request => {
                    return this.__getModules(request);
                });
            } else {
                // Send a command to the main window to look for modules to resolve the request
                return _IPC2.default.sendSync("Registry.request", requests)[0];
            }
        } else {
            // Retrieve the modules to resolve the request
            if (_isMain2.default) {
                // Directly resolve the request as we have access to all modules
                const requestsModules = requests.map(request => {
                    return this.__getModules(request);
                });
                return this.__finishRequest(type, requests, requestsModules);
            } else {
                // Send a command to the main window to look for modules to resolve the request
                return _IPC2.default.send("Registry.request", requests, 0).then(responses => {
                    const requestsModules = responses[0];

                    return this.__finishRequest(type, requests, requestsModules);
                });
            }
        }
    }

    // TODO: test if this method works at all
    /**
     * Gets channels to all instances of a specific module class
     * @param {(Class<Module>|Module)} module - The module to get the instance of
     * @param {string} [subChannel] - The sub channel to target
     * @param {(Module|string)} source - The channelID to return messages to if needed
     * @param {number} [windowID] - Only looks in this window for instances if provided
     * @returns {ChannelSender[]} The channels that were set up for the found modules
     * @async
     * @public
     */
    static async getModuleInstanceChannels(module, subChannel, source, windowID) {
        if (module.getPath) module = module.getPath();
        const responses = (await _IPC2.default.send("Registry.getModuleInstances", module, 0))[0];
        const instancePaths = responses;
        if (source.getPath) source = source.getPath();

        if (windowID != undefined) instancePaths = instancePaths.filter(path => {
            return path.windowID == windowID;
        });

        instancePaths = instancePaths.map(path => {
            return _channelHandler2.default.createSender(path.path, subChannel, source);
        });

        return _promise2.default.all(instancePaths);
    }

    /**
     * The initial setup method to be called by this file itself, initialises the static fields of the class
     * @return {undefined}
     * @private
     */
    static __setup() {
        // Stores the listeners for handle and module requests, indexed by type
        this.listeners = {};

        // Stores the registered modules themselves, indexed by path
        this.moduleClasses = {};

        // Stores instances of modules registered in this window/process
        this.moduleInstances = [];

        // Set up the IPC listeners in the renderers and main process to allow renderers to request modules
        if (_isMain2.default) {
            // Filter out possible modules in this window to handle the handle request
            _IPC2.default.on("Registry.request", event => {
                const requests = event.data;

                // Retrieve the priority mapping for every request
                const requestsModules = requests.map(request => {
                    return this.__getModules(request);
                });

                // Return the mapping of modules and their priorities
                return requestsModules;
            });

            // Stores unique module instance request paths, indexed by [request path][UID]
            this.requestPaths = {};

            // Stores unique module instance request path lists, indexed by module path
            this.moduleInstancePaths = {};

            // Listen for module instances being registered
            _IPC2.default.on("Registry.registerModuleInstance", event => {
                const requestPath = new _requestPath2.default(event.data.requestPath);

                const type = requestPath.getModuleID().module;
                let pathList = this.moduleInstancePaths[type];
                if (!pathList) pathList = this.moduleInstancePaths[type] = [];
                pathList.push({
                    window: event.sourceID,
                    path: requestPath.toString(true)
                });

                let paths = this.requestPaths[requestPath.toString()];
                if (!paths) paths = this.requestPaths[requestPath.toString()] = {};

                let ID = 0;
                while (paths[ID]) ID++;

                requestPath.getModuleID().ID = ID;
                paths[ID] = requestPath;
                return ID;
            });

            // Listen for module instances being deregistered
            _IPC2.default.on("Registry.deregisterModuleInstance", event => {
                const requestPath = new _requestPath2.default(event.data.requestPath);

                const type = requestPath.getModuleID().module;
                const pathList = this.moduleInstancePaths[type];
                if (pathList) {
                    const requestPathString = requestPath.toString(true);
                    this.moduleInstancePaths[type] = pathList.filter(path => {
                        return path.path != requestPathString;
                    });
                }

                const paths = this.requestPaths[requestPath.toString()];
                const ID = requestPath.getModuleID().ID;
                if (paths) delete paths[ID];
            });

            // Listen for windows/processes requesting instances of a certain module
            _IPC2.default.on("Registry.getModuleInstances", event => {
                const data = event.data;
                const modulePath = event.modulePath;
                return this.moduleInstancePaths[modulePath];
            });
        }
    }
}
Registry.__setup();
exports.default = Registry;
//# sourceMappingURL=registry.js.map