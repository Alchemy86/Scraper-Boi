// logger.ts

export default {
    Info(message: string) {
        console.log(`INFO: ${message}`);
    },
    Error(message: string) {
        console.error(`ERROR: ${message}`);
    }
};
