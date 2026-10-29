#!/usr/bin/env bash
set -euo pipefail

project_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
dist_root="$project_root/dist"

rm -rf "$dist_root"
mkdir -p "$dist_root/server" "$dist_root/.openai"
node --input-type=module -e 'import fs from "node:fs";fs.writeFileSync("dist/server/index.js",fs.readFileSync("worker/index.js","utf8").replace("/* MONITOR_SERVER */",fs.readFileSync("worker/monitor.js","utf8")+"\n"+fs.readFileSync("worker/sync.js","utf8")))' 
cp "$project_root/.openai/hosting.json" "$dist_root/.openai/hosting.json"

echo "Built $dist_root"
