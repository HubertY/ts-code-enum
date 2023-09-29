import rp from "request-promise";
import cheerio from "cheerio";
import fs from "fs/promises";

async function updateFile(path: string, s: string) {
    const old = await fs.readFile(path, "utf-8").catch(() => "");
    if (old === s) {
        return false;
    }
    await fs.writeFile(path, s, "utf-8");
    return true;
}

async function main() {
    let data = new Map<string, Set<string>>();

    const mdnUrl = "https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_code_values";
    const keyValueRegex = /\"([a-z0-9_]+)\"/i;

    console.info("Making GET request to MDN...");
    const pageHtml: string = await rp(mdnUrl);
    console.info("Response received...");

    const $ = cheerio.load(pageHtml);
    $("table").each((tablei, e) => {
        $(e).find("tr").each((_, e) => {
            $(e).find("td").each((tdi, e) => {
                const code = $(e).find("code").text()
                const matches = keyValueRegex.exec(code);
                const value = matches && matches[1];
                if (value) {
                    const set = data.get(`${tablei}-${tdi}`) ?? new Set();
                    set.add(value.trim());
                    data.set(`${tablei}-${tdi}`, set);
                }
            });
        });
    });

    console.info("Merging tables...");
    const everything = [...data.values()].reduce((a, v, i) => {
        if (i === 0) {
            return [...v];
        }
        else {
            return a.filter(x => v.has(x));
        }
    }, [] as string[]);

    console.info(`${everything.length} keys found...`);

    const WRITE_PATH = "./src/index.ts"
    const WRITE_PATH_CONST = "./src/const.ts"
    const writeData = [
        "export enum KBCode {",
        everything.map(s => `    ${s} = '${s}'`).join(",\n"),
        "}"
    ].join("\n");
    const writeDataConst = [
        "export const enum KBCode {",
        everything.map(s => `    ${s} = '${s}'`).join(",\n"),
        "}"
    ].join("\n");
    const updated = await updateFile(WRITE_PATH, writeData) && await updateFile(WRITE_PATH_CONST, writeDataConst);
    if (updated) {
        console.info("Updated source files.")
    }
    else {
        console.info("Source is up to date.")
    }
}

main();