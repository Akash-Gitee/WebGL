const path = require("path");

module.exports = {
    entry: "./Showcase/3DEditor/EditorApplication.ts",
    output: {
        filename: "EditorApplication.js",
        path: path.resolve(__dirname, "dist/Showcase/3DEditor")
    },
    resolve: {
        extensions: [".ts", ".js"]
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: "ts-loader",
                exclude: /node_modules/
            }
        ]
    },
    mode: "production"
};
