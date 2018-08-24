import IPC from "../communication/IPC";
import Module from "./module";
/**
 * @typedef {Object} RequestPath~ModuleID
 * @property {string} module - The path to the module class
 * @property {number} ID - The unique ID of the module instance
 */

class RequestPath {
    /**
     * Create a request path that can be used to uniquely identifying module instances
     * @param {string} path - The string representation of the request path
     * @constructs RequestPath
     */
    constructor(path) {
        if (typeof path != "string" && !(path instanceof Array))
            path = path.toString();
        if (typeof path == "string") {
            path = path.split("->").map(module => {
                module = module.split(":");
                return {
                    module: module[0],
                    ID: Number(module[1] || 0),
                };
            });
        }

        this.modules = path;
    }

    /**
     * Gets the string representation of this path
     * @param {boolean} unique - Whether or not to include the unique ID of each module instance
     * @returns {string} The string representation of this request path
     * @public
     */
    toString(unique) {
        return this.modules
            .map(module => {
                if (unique) return module.module + ":" + module.ID;
                return module.module + "";
            })
            .join("->");
    }

    /**
     * Creates a new instance of RequestPath with the last n modules removed
     * @param {number} removeCount - The number of modules to remove
     * @returns {RequestPath} The newly created request path
     * @public
     */
    getSubPath(removeCount) {
        const requestPath = new RequestPath(this.toString(true));
        const modules = requestPath.modules;
        modules.splice(modules.length - removeCount, removeCount);
        return requestPath;
    }

    /**
     * Creates a new instance of RequestPath with a new module added
     * @param {(Module|string)} module - The module to append to the path
     * @param {number} ID - The unique ID of the module that is added
     * @returns {RequestPath} The newly created request path
     * @public
     */
    augmentPath(module, ID) {
        if (typeof module != "string") module = module.toString();
        const requestPath = new RequestPath(this.toString(true));
        requestPath.modules.push({
            module: module,
            ID: Number(ID || 0),
        });
        return requestPath;
    }

    /**
     * Returns the moduleID at a specific index
     * @param {number} [index] - The indedx at which to get the module (returns the last if left out)
     * @returns {RequestPath~ModuleID} The moduleID
     * @public
     */
    getModuleID(index) {
        if (index == undefined) index = this.modules.length - 1;
        return this.modules[index];
    }
}
export default RequestPath;
