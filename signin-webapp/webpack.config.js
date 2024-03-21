// Copyright 2023-2024 Google LLC.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

/* global process */

const path = require("path");
const fs = require("fs");
const webpack = require("webpack");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const packageVersion = require("./package.json").version;
const FileManagerPlugin = require("filemanager-webpack-plugin");
const buildVersion = "2024-03-19";

// for post-build copy into the proxy bundle
const RELATIVE_DESTINATION_LOCATION = "../../apiproxy/resources/jsc";

function makeConfig(mode) {
  const config = {
    // this works, but webpack complains that it is large
    entry: ["./src/js/page-logic.js", "./src/scss/app.scss"],

    // // This did not work
    // entry: {
    //   mainapp: {
    //     import: "./src/js/page-logic.js",
    //     dependOn: "css"
    //   },
    //   css: "./src/scss/app.scss"
    // },

    target: "web",

    output: {
      path: path.resolve("dist"),
      filename: "js/main.js"
    },

    module: {
      rules: [
        {
          test: /\.(woff(2)?|eot|ttf|otf|svg|png)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
          type: "asset",
          parser: {
            dataUrlCondition: {
              maxSize: 8 * 1024 // in bytes
            }
          },
          generator: {
            // the file path to use when emitting a file
            filename: "assets/[hash][ext][query]"
          }
        },

        {
          test: /\.scss$/,
          use: [
            "style-loader",
            {
              loader: MiniCssExtractPlugin.loader,
              options: {
                esModule: false,
                publicPath: "../" // prepend this to url() in the CSS
              }
            },
            "css-loader",
            "sass-loader"
          ]
        }
        // {
        //   test: /\.scss$/,
        //   use: [
        //     "style-loader",
        //     {
        //       loader: MiniCssExtractPlugin.loader,
        //       options: {
        //         esModule: false,
        //         publicPath: "../" // prepend this to url() in the CSS
        //       }
        //     },
        //     "css-loader",
        //     "sass-loader"
        //   ]
        // }
      ]
    },

    plugins: [
      // clean dist folder before each build, to force full build
      new FileManagerPlugin({
        events: {
          onStart: {
            delete: [
              {
                source: path.join(__dirname, "dist/").replaceAll("\\", "/"),
                options: {
                  force: true,
                  recursive: true
                }
              }
            ]
          }
        }
      }),

      new CopyPlugin({
        patterns: [
          { from: "src/signin-page.html", to: "signin-page.html" },
          { from: "src/signout-page.html", to: "signout-page.html" },
          { from: "src/signin-complete.html", to: "signin-complete.html" }
          // {
          //   from: "src/notfound.html",
          //   to: "notfound.html"
          // }
        ]
      }),

      new MiniCssExtractPlugin({
        filename: "css/[name].css"
      }),

      new webpack.DefinePlugin({
        BUILD_VERSION: JSON.stringify(packageVersion + "." + buildVersion)
      }),

      {
        // ad-hoc plugin to copy dist files to RELATIVE_DESTINATION_LOCATION
        apply: (compiler) => {
          const PLUGIN_NAME = "MyAfterEmitPlugin";
          //const logger = compiler.getInfrastructureLogger(PLUGIN_NAME);
          // logger.info("info from compiler");
          compiler.hooks.afterEmit.tap(PLUGIN_NAME, (compilation) => {
            const logger = compilation.getLogger(PLUGIN_NAME);
            const maybeCreateDir = (dirPath) => {
              if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath);
              }
            };
            const srcDir = compilation.compiler.outputPath,
              destDir = path.normalize(
                path.join(srcDir, RELATIVE_DESTINATION_LOCATION)
              );
            maybeCreateDir(destDir);
            const re = new RegExp("/", "g");
            compilation.emittedAssets.forEach((item) => {
              const src = path.join(srcDir, item),
                dstItem = item.replace(re, "-") + ".txt",
                dst = path.join(destDir, dstItem),
                tailDir1 = path.basename(srcDir),
                x = path.basename(destDir),
                y = path.dirname(destDir),
                tailDir2 = `${path.basename(y)}/${x}`;
              // containingDir = path.dirname(dst);
              // const shortDir = path.join(RELATIVE_DESTINATION_LOCATION, item);
              // maybeCreateDir(containingDir);
              logger.info(
                `${PLUGIN_NAME} copy ${tailDir1}/${item} to [apiproxy]${tailDir2}/${dstItem}`
              );
              fs.copyFileSync(src, dst);
            });
          });
        }
      }
    ]
  };

  if (mode === "development") {
    config.devtool = "source-map";
    config.output.sourceMapFilename = "[file].map";
  }

  return config;
}

module.exports = (_env, argv) => {
  return makeConfig(argv.mode);
};
