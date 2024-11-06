/**
 * copyright (c) 2015 - 2018, Nordic Semiconductor ASA
 *
 * all rights reserved.
 *
 * redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *
 * 1. redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 *
 * 2. redistributions in binary form, except as embedded into a nordic
 *    semiconductor asa integrated circuit in a product or a software update for
 *    such product, must reproduce the above copyright notice, this list of
 *    conditions and the following disclaimer in the documentation and/or other
 *    materials provided with the distribution.
 *
 * 3. neither the name of Nordic Semiconductor ASA nor the names of its
 *    contributors may be used to endorse or promote products derived from this
 *    software without specific prior written permission.
 *
 * 4. this software, with or without modification, must only be used with a
 *    Nordic Semiconductor ASA integrated circuit.
 *
 * 5. any software provided in binary form under this license must not be reverse
 *    engineered, decompiled, modified and/or disassembled.
 *
 * this software is provided by Nordic Semiconductor ASA "as is" and any express
 * or implied warranties, including, but not limited to, the implied warranties
 * of merchantability, noninfringement, and fitness for a particular purpose are
 * disclaimed. in no event shall Nordic Semiconductor ASA or contributors be
 * liable for any direct, indirect, incidental, special, exemplary, or
 * consequential damages (including, but not limited to, procurement of substitute
 * goods or services; loss of use, data, or profits; or business interruption)
 * however caused and on any theory of liability, whether in contract, strict
 * liability, or tort (including negligence or otherwise) arising in any way out
 * of the use of this software, even if advised of the possibility of such damage.
 *
 */

import Debug from "debug";
import DfuTransportPrn from "./DfuTransportPrn.js";
import { DfuError, ErrorCode } from "./DfuError.js";

const debug = Debug("dfu:noble");

let _noble;
async function getNoble() {
	const noble = _noble ?? (await import("@abandonware/noble")).default; //require('@abandonware/noble')();
	_noble = noble;
	if (noble._state != "poweredOn") {
		await new Promise((resolve, reject) => {
			const t = setTimeout(() => {
				reject(new Error("Bluetooth not poweredOn after 10s"));
			}, 10000);
			noble?.on("stateChange", (state) => {
				debug("noble stateChage", state);
				if (state == "poweredOn") {
					clearTimeout(t);
					resolve();
				}
			});
		});
	}
	return noble;
}
/**
 * noble DFU transport.
 *
 * 'noble' means "NOde Bluetooth Low Energy". The use case for this transport
 * is running it on a linux/MacOSX/windows host, which must have a BLE adapter itself.
 * See https://github.com/sandeepmistry/noble/blob/master/README.md
 *
 * The "noble" transport must be given an instance of noble's "peripheral" when instantiated.
 */

export default class DfuTransportNoble extends DfuTransportPrn {
	constructor(peripheral, packetReceiveNotification = 16) {
		super(packetReceiveNotification);

		this.peripheral = peripheral;

		// These will be populated when connecting to the BLE peripheral
		this.dfuControlCharacteristic = undefined;
		this.dfuPacketCharacteristic = undefined;

		// Hard-coded BLE MTU
		this.mtu = 20;
	}

	// Given a command (including opcode), perform SLIP encoding and send it
	// through the wire.
	writeCommand(bytes) {
		// Cast the Uint8Array info a Buffer so it works on nodejs v6
		const bytesBuf = Buffer.from(bytes);
		debug(" ctrl --> ", bytesBuf);

		return new Promise((res, rej) => {
			setTimeout(() => {
				this.dfuControlCharacteristic.write(bytesBuf, false, (err) => {
					if (err) {
						rej(err);
					} else {
						res();
					}
				});
			}, 100);
		});
	}

	// Given some payload bytes, pack them into a 0x08 command.
	// The length of the bytes is guaranteed to be under this.mtu thanks
	// to the DfuTransportPrn functionality.
	writeData(bytes) {
		// Cast the Uint8Array info a Buffer so it works on nodejs v6
		const bytesBuf = Buffer.from(bytes);
		debug(" data --> ", bytesBuf);

		return new Promise((res, rej) => {
			this.dfuPacketCharacteristic.write(bytesBuf, true, (err) => {
				if (err) {
					rej(err);
				} else {
					res();
				}
			});
			//             }, 50);
		});
	}

	connect() {
		if (this.peripheral.state == "connected") {
			return;
		}
		return new Promise((res, rej) => {
			this.peripheral.connect((err) => {
				if (err) {
					rej(err);
				} else {
					this.peripheral.once("disconnect", () => {
						debug(
							"Disconnected from peripheral: ",
							this.peripheral.id,
							this.peripheral.advertisement.localName
						);
						this.readyPromise = undefined;
						this.dfuControlCharacteristic = undefined;
						this.dfuPacketCharacteristic = undefined;
					});
					res();
				}
			});
		});
	}

	discoverServices(uuids) {
		return new Promise((res, rej) => {
			this.peripheral.discoverServices(uuids, (err, services) => (err ? rej(err) : res(services)));
		});
	}

	discoverCharacteristics(service, characUuids) {
		return new Promise((res, rej) => {
			service.discoverCharacteristics(characUuids, (err, characteristics) =>
				err ? rej(err) : res(characteristics)
			);
		});
	}

	// Aux. Connects to this.peripheral, discovers services and characteristics,
	// and stores a reference into this.dfuControlCharacteristic and this.dfuPacketCharacteristic
	async getCharacteristics() {
		await this.connect();
		debug("Instantiating noble transport to: ", this.peripheral.id, this.peripheral.advertisement.localName);
		const services = await this.discoverServices(["fe59"]);
		debug("discovered dfuService");
		const service = services[0];
		const characteristics = await this.discoverCharacteristics(service, null);
		debug("discovered the following characteristics:");
		for (let i = 0, l = characteristics.length; i < l; i += 1) {
			debug(`  ${i} uuid: ${characteristics[i].uuid}`);
			if (characteristics[i].uuid === "8ec90001f3154f609fb8838830daea50") {
				this.dfuControlCharacteristic = characteristics[i];
			}
			if (characteristics[i].uuid === "8ec90002f3154f609fb8838830daea50") {
				this.dfuPacketCharacteristic = characteristics[i];
			}
			if (characteristics[i].uuid === "8ec90003f3154f609fb8838830daea50") {
				//without bonds
				this.buttonlessDfuCharacteristic = characteristics[i];
			}
			if (characteristics[i].uuid === "8ec90004f3154f609fb8838830daea50") {
				//with bonds
				this.buttonlessDfuCharacteristic = characteristics[i];
			}
		}
	}

	// Opens the port, sets the PRN, requests the MTU.
	// Returns a Promise when initialization is done.
	ready() {
		if (this.readyPromise) {
			return this.readyPromise;
		}

		this.readyPromise = Promise.race([
			this.getCharacteristics(),
			new Promise((res, rej) => {
				setTimeout(() => rej(new DfuError(ErrorCode.ERROR_TIMEOUT_FETCHING_CHARACTERISTICS)), 5000);
			}),
		])
			.then(() => {
				if (!(this.dfuControlCharacteristic && this.dfuPacketCharacteristic)) {
					return Promise.reject(new DfuError(ErrorCode.ERROR_CAN_NOT_DISCOVER_DFU_CONTROL));
				}
				// Subscribe to notifications on the control characteristic
				debug(
					"control characteristic:",
					this.dfuControlCharacteristic.uuid,
					this.dfuControlCharacteristic.properties
				);

				return new Promise((res, rej) => {
					debug("Subscribing to notifications on the ctrl characteristic");
					this.dfuControlCharacteristic.subscribe((err) => {
						if (err) {
							return rej(new DfuError(ErrorCode.ERROR_CAN_NOT_SUBSCRIBE_CHANGES));
						}
						this.dfuControlCharacteristic.on("data", (data) => {
							debug(" recv <-- ", data);
							return this.onData(data);
						});
						return res();
					});
				});
			})
			.then(() =>
				this.writeCommand(
					new Uint8Array([
						0x02, // "Set PRN" opcode
						this.prn & 0xff, // PRN LSB
						(this.prn >> 8) & 0xff, // PRN MSB
					])
				)
					.then(this.read.bind(this))
					.then(this.assertPacket(0x02, 0))
			);

		return this.readyPromise;
	}

	/**
	 * Buttonless flow
	 * 1. find buttonless dfu service
	 * 2. ensure is in application mode, else proceed directly
	 * 3. jump to bootloader
	 *  3.1. send new name
	 *  3.2. send buttonless dfu request (will disconnect)
	 * 4. scan for new peripheral with MAC address + 1 or new name (macOS)
	 * 5. replace peripheral with new one
	 * 6. proceed with dfu
	 * @returns {Promise} a Promise that resolves when buttonless flow is done
	 */
	async startButtonless() {
		debug("Starting buttonless flow");
		await this.getCharacteristics();
		debug("discovered dfuService");
		//determine it is in application mode
		const buttonlessDfuCharacteristic = this.buttonlessDfuCharacteristic;
		if (!buttonlessDfuCharacteristic) {
			//no buttonless dfu characteristic. It might be in bootloader already, or not support buttonless dfu. Try proceed
			return;
		}
		//jump to bootloader
		debug("Jumping to bootloader");
		//enable dfu characterictics notification
		let dfuResponse;
		buttonlessDfuCharacteristic.subscribe();
		buttonlessDfuCharacteristic.on("data", (data) => {
			debug(" recv <-- ", data);
			const [opCode, reqCode, status] = data;
			dfuResponse({ opCode, reqCode, status });
		});
		function dfuRequest(data) {
			debug("Send buttonless dfu request %o", data);
			return new Promise((res, rej) => {
				setTimeout(() => rej(new DfuError(ErrorCode.ERROR_RSP_OPERATION_FAILED)), 5000);
				dfuResponse = res;
				buttonlessDfuCharacteristic.write(Buffer.from(data), false, (err) => (err ? rej(err) : undefined));
			});
		}
		//send new name
		const name = `Dfu${Math.floor(Math.random() * 0x100000)
			.toString(16)
			.padStart(5, "0")}`;
		const nameBuf = Buffer.from(name);
		const data = Buffer.concat([Buffer.from([0x02, nameBuf.length]), nameBuf]);
		debug("Send new name %o", data);
		const setNameRes = await dfuRequest(data);
		if (setNameRes.status != 1) {
			throw new DfuError(ErrorCode.ERROR_RSP_OPERATION_FAILED);
		}
		debug("Sent new name. Enter bootloader");
		//send buttonless dfu request
		const disconnectPromise = new Promise((res, rej) => {
			setTimeout(() => rej(new DfuError(ErrorCode.ERROR_TIMEOUT_JUMPING_TO_BOOTLOADER)), 5000);
			this.peripheral.once("disconnect", res);
		});
		const enterBootloaderReqData = Buffer.from([0x01]);
		debug("Send buttonless dfu request %o", enterBootloaderReqData);
		dfuRequest(enterBootloaderReqData); //do not await since the response might not arrive as it reset
		debug("Waiting for disconnect");
		await disconnectPromise;
		buttonlessDfuCharacteristic.unsubscribe();
		this.peripheral.removeAllListeners();
		//scan for new peripheral
		debug("Scanning for new peripheral");
		const noble = await getNoble();
		const targetAddr = process.platform == "darwin" ? undefined : addr2bigint(this.peripheral.address) + BigInt(1);
		await new Promise((res, rej) => {
			setTimeout(() => rej(new DfuError(ErrorCode.ERROR_TIMEOUT_SCANNING_NEW_PERIPHERAL)), 5000);
			noble.on("discover", (peripheral) => {
				debug("Found new peripheral", peripheral.address, this.peripheral.address);
				if ((targetAddr && peripheral.address == targetAddr) || peripheral.advertisement.localName == name) {
					debug("Found new peripheral with same address. Replacing peripheral");
					noble.stopScanning();
					this.peripheral = peripheral;
					this.readyPromise = undefined;
					this.dfuControlCharacteristic = undefined;
					this.dfuPacketCharacteristic = undefined;
					res();
				}
			});
			noble.startScanning(undefined, true);
		});
	}
}

function addr2bigint(addr) {
	return addr
		.split(":")
		.map((it) => parseInt(it, 16))
		.reduce((a, b) => (a << 8n) + BigInt(b), 0n);
}
