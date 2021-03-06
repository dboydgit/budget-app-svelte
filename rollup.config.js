import svelte from "rollup-plugin-svelte";
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import livereload from "rollup-plugin-livereload";
import { terser } from "rollup-plugin-terser";
import css from "rollup-plugin-css-only";
import includePaths from "rollup-plugin-includepaths";
import sveltePreprocess from "svelte-preprocess";
import replace from "rollup-plugin-replace";
import { generateSW } from "rollup-plugin-workbox";
import del from "rollup-plugin-delete";
import { config } from "dotenv";

const production = !process.env.ROLLUP_WATCH;
const netlify = process.env.NETLIFY === "true";

const swVersion = "0.0.1-5";

let includePathOptions = {
  include: {},
  paths: ["src"],
  external: [],
  extensions: [".js", ".json", ".svelte"],
};

function serve() {
  let server;

  function toExit() {
    if (server) server.kill(0);
  }

  return {
    writeBundle() {
      if (server) return;
      server = require("child_process").spawn("npm", ["run", "start", "--", "--dev"], {
        stdio: ["ignore", "inherit", "inherit"],
        shell: true,
      });
      process.on("SIGTERM", toExit);
      process.on("exit", toExit);
    },
  };
}

export default {
  input: "src/main.js",
  output: {
    sourcemap: true,
    format: "iife",
    name: "app",
    file: "public/build/bundle.js",
  },
  plugins: [
    replace({
      _process: JSON.stringify({
        env: {
          ...config().parsed,
        },
      }),
      "process.env.NETLIFY": netlify,
      "process.env.FIREBASE_API_KEY_DEV": JSON.stringify(process.env.FIREBASE_API_KEY_DEV),
      "process.env.FIREBASE_APP_ID_DEV": JSON.stringify(process.env.FIREBASE_APP_ID_DEV),
      "process.env.FIREBASE_AUTH_DOMAIN_DEV": JSON.stringify(process.env.FIREBASE_AUTH_DOMAIN_DEV),
      "process.env.FIREBASE_MEASUREMENT_ID_DEV": JSON.stringify(
        process.env.FIREBASE_MEASUREMENT_ID_DEV
      ),
      "process.env.FIREBASE_MESSAGING_ID_DEV": JSON.stringify(
        process.env.FIREBASE_MESSAGING_ID_DEV
      ),
      "process.env.FIREBASE_PROJECT_ID_DEV": JSON.stringify(process.env.FIREBASE_PROJECT_ID_DEV),
      "process.env.FIREBASE_STORAGE_BUCKET_DEV": JSON.stringify(
        process.env.FIREBASE_STORAGE_BUCKET_DEV
      ),
      "process.env.NODE_ENV": production
        ? JSON.stringify("production")
        : JSON.stringify("development"),
    }),
    del({ targets: ["public/workbox-*"] }),
    includePaths(includePathOptions),
    generateSW({
      swDest: "public/service-worker.js",
      globDirectory: "public/",
      cacheId: `neatBudget-${swVersion}`,
      navigateFallback: "/index.html",
      cleanupOutdatedCaches: true,
      skipWaiting: true,
      // Define runtime caching rules.
      runtimeCaching: [
        {
          urlPattern: ({ request }) => request.destination === "image",
          handler: "CacheFirst",
          options: {
            cacheName: "images",
          },
        },
        {
          urlPattern: ({ request }) => request.destination === "style",
          handler: "StaleWhileRevalidate",
          options: {
            cacheName: "css",
          },
        },
        {
          urlPattern: ({ request }) => request.destination === "script",
          handler: "StaleWhileRevalidate",
          options: {
            cacheName: "javascript",
          },
        },
      ],
    }),
    svelte({
      compilerOptions: {
        // enable run-time checks when not in production
        dev: !production,
      },
      preprocess: sveltePreprocess({
        // https://github.com/kaisermann/svelte-preprocess/#user-content-options
        sourceMap: !production,
        scss: {
          includePaths: ["src"],
        },
        postcss: {
          plugins: [require("tailwindcss"), require("autoprefixer"), require("postcss-nesting")],
        },
      }),
    }),
    // we'll extract any component CSS out into
    // a separate file - better for performance
    css({ output: "bundle.css" }),

    // If you have external dependencies installed from
    // npm, you'll most likely need these plugins. In
    // some cases you'll need additional configuration -
    // consult the documentation for details:
    // https://github.com/rollup/plugins/tree/master/packages/commonjs
    resolve({
      browser: true,
      dedupe: ["svelte"],
    }),
    commonjs(),

    // In dev mode, call `npm run start` once
    // the bundle has been generated
    !production && serve(),

    // Watch the `public` directory and refresh the
    // browser on changes when not in production
    !production && livereload("public"),

    // If we're building for production (npm run build
    // instead of npm run dev), minify
    production && terser(),
  ],
  watch: {
    clearScreen: false,
  },
};
