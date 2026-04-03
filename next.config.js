const withSerwist = require("@serwist/next").default

/** @type {import('next').NextConfig} */
const nextConfig = {}

module.exports = withSerwist({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
})(nextConfig)
