import noble, { Peripheral } from "@abandonware/noble";
import readline from "node:readline";
import { DfuOperation, DfuTransportNoble, DfuUpdates } from "noble-nrf-dfu";
import path from "node:path";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

let peripherals: Peripheral[] = [];

async function scan(rssiThres: number, millis: number) {
    peripherals = [];
    await new Promise((resolve, reject) => {
        if (noble._state === "poweredOn") {
            resolve(true);
        } else {
            noble.on("stateChange", (state) => {
                if (state === "poweredOn") {
                    resolve(true);
                }
            });
        }
    });
    const onDiscover = async (peripheral:Peripheral) => {
        if (peripheral.advertisement.localName && peripheral.rssi > rssiThres) {
            const i = peripherals.push(peripheral);
            console.log(`${i}\t${peripheral.id}\t${peripheral.advertisement.localName}\t${peripheral.rssi}`);
        }
    };
    noble.on("discover", onDiscover);
    noble.startScanning(undefined, false);
    await new Promise((resolve, reject) => {
        setTimeout(resolve, millis);
    });
    noble.removeListener("discover",onDiscover);
    noble.stopScanning();
}

async function main() {
    let i = 0;
    while (i == 0) {
        await scan(-70, 10000);
        i = await new Promise<number>((resolve, reject) => {
            rl.question("Enter index of the device to connect, or 0 to scan again: ", (answer) => {
                resolve(parseInt(answer));
            });
        });
    }
    console.log(i);
    if (isNaN(i) || i < 1 || i > peripherals.length) {
        console.log("Device not chosen");
        process.exit();
        return;
    }
    const peripheral = peripherals[i - 1];
    console.log(`Connecting to ${peripheral.advertisement.localName}...`);
    await new Promise<void>((resolve, reject) => peripheral.connect((error) => error ? reject(error) : resolve()));
    console.log("Connected!");
    const dfuService = (await peripheral.discoverServicesAsync(["fe59"]))[0];
    if (!dfuService) {
        throw new Error("DFU service not found!");
    }
    //prompt for file path to perform dfu
    const filePath = await new Promise<string>((resolve, reject) => {
        rl.question("Enter path to firmware zip file: ", (answer) => {
            resolve(answer);
        });
    });
    const zipFilePath = path.resolve(process.cwd(),filePath);
    console.log(`Performing DFU on ${peripheral.advertisement.localName} with ${zipFilePath}...`);
    const updates = await DfuUpdates.fromZipFilePath(zipFilePath);
    const nobleTransport = new DfuTransportNoble(peripheral);
    nobleTransport.on("progress", ({sent,total}) => {
        //print progress bar on stdout
        const percent = Math.floor(sent / total * 100);
        const bar = "[" + "#".repeat(percent) + "-".repeat(50 - percent/2) + "]";
        process.stdout.write(`\r${bar} ${percent}%`);
    });
    const dfu = new DfuOperation(updates, nobleTransport);
    process.stdout.write(`\r${"[" + "-".repeat(50) + "]"} 0%`);
    await dfu.start(false);
    process.stdout.write(`\r${"[" + "#".repeat(50) + "]"} 100%`);
    console.log("\nDFU complete!");
    process.exit();
}

main();
