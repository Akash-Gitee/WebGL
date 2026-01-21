const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = (env, argv) => {
    const isDevelopment = argv.mode === "development";

    return {
        entry: "./Showcase/3DEditor/EditorApplication.ts",
        output: {
            filename: "EditorApplication.js",
            path: path.resolve(__dirname, "dist/Showcase/3DEditor"),
            clean: true // Clean the output directory before emit
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
        plugins: [
            new CopyWebpackPlugin({
                patterns: [
                    // Copy index.html
                    {
                        from: "Showcase/3DEditor/index.html",
                        to: "index.html"
                    },
                    // Copy CSS styles into the local subfolder to support root-level hosting
                    {
                        from: "engine/UserInterface/styles",
                        to: "engine/UserInterface/styles"
                    }
                ]
            })
        ],
        devServer: {
            static: [
                {
                    directory: path.join(__dirname, "dist/Showcase/3DEditor"),
                    publicPath: "/"
                },
                {
                    directory: path.join(__dirname, "dist"),
                    publicPath: "/"
                }
            ],
            compress: true,
            port: 8081,
            hot: true,
            open: true,
            historyApiFallback: {
                index: "/index.html"
            }
        },
        devtool: isDevelopment ? "source-map" : false,
        mode: argv.mode || "production"
    };
};
