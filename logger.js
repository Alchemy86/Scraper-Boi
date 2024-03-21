"use strict";
// logger.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    Info(message) {
        console.log(`INFO: ${message}`);
    },
    Error(message) {
        console.error(`ERROR: ${message}`);
    }
};
