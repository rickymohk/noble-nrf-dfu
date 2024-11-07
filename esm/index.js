import fs from 'fs';
import Debug from 'debug';
import JSZip from 'jszip/dist/jszip.js';
import { EventEmitter } from 'node:events';

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

/**
 * Represents a DFU Operation - the act of updating the firmware on a
 * nRF device.
 *
 * A firmware update is composed of one or more updates - e.g. bootloader then application,
 * or softdevice then application, or bootloader+softdevice then application, or only
 * one of these pieces.
 *
 * A nRF device is represented by the transport used to update it - the DfuOperation does
 * not care if that device is connected through USB and has serial number 12345678, or if that
 * device is connected through Bluetooth Low Energy and has Bluetooth address AA:BB:CC:DD:EE:FF.
 *
 * The transport must be instantiated prior to instantiating the DFU operation. This includes
 * doing things such as service discovery, buttonless BLE DFU initialization, or claiming
 * a USB interface of a USB device.
 */

class DfuOperation {
	constructor(dfuUpdates, dfuTransport, autoStart = false) {
		this.updates = dfuUpdates.updates;
		this.transport = dfuTransport;

		if (autoStart) {
			this.start();
		}
	}

	/**
	 * Starts the DFU operation. Returns a Promise that resolves as soon as
	 * the DFU has been performed (as in "everything has been sent to the
	 * transport, and the CRCs back seem correct").
	 *
	 * If called with a truthy value for the 'forceful' parameter, then
	 * the DFU procedure will skip the steps that detect whether a previous
	 * DFU procedure has been interrupted and can be continued. In other
	 * words, the DFU procedure will be started from the beginning, regardless.
	 *
	 * Calling start() more than once has no effect, and will only return a
	 * reference to the first Promise that was returned.
	 *
	 * @param {Bool} forceful if should skip the steps
	 * @return {Promise} a Promise that resolves as soon as the DFU has been performed
	 */
	start(forceful = false) {
		if (this.finishPromise) {
			return this.finishPromise;
		}
		this.finishPromise = this.performNextUpdate(0, forceful);
		return this.finishPromise;
	}

	// Takes in an update from this._update, performs it. Returns a Promise
	// which resolves when all updates are done.
	// - Tell the transport to send the init packet
	// - Tell the transport to send the binary blob
	// - Proceed to the next update
	performNextUpdate(updateNumber, forceful) {
		if (this.updates.length <= updateNumber) {
			return Promise.resolve();
		}

		let start;
		if (forceful) {
			start = this.transport.restart();
		} else {
			start = Promise.resolve();
		}

		return start
			.then(() => this.transport.startButtonless())
			.then(() => this.transport.sendInitPacket(this.updates[updateNumber].initPacket))
			.then(() => this.transport.sendFirmwareImage(this.updates[updateNumber].firmwareImage))
			.then(() => this.performNextUpdate(updateNumber + 1, forceful));
	}
}

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


const debug$4 = Debug("dfu:updates");

// Object.entries polyfill, as per
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/entries
if (!Object.entries) {
	Object.entries = (obj) => {
		const ownProps = Object.keys(obj);
		let i = ownProps.length;
		const resArray = new Array(i); // preallocate the Array
		while (i) {
			i -= 1;
			resArray[i] = [ownProps[i], obj[ownProps[i]]];
		}
		return resArray;
	};
}

/**
 * Represents a set of DFU updates.
 *
 * A DFU update is an update of either:
 * - The bootloader
 * - The SoftDevice
 * - The user application
 * - The bootloader plus the SoftDevice
 *
 * From the technical side, a DFU update is a tuple of an init packet and
 * a binary blob. Typically, the init packet is a protocol buffer ("protobuf"
 * or "pbf" for short) indicating the kind of memory region to update,
 * the size to update, whether to reset the device, extra checksums, which
 * kind of nRF chip family this update is meant for, and maybe a crypto signature.
 *
 * Nordic provides a default pbf definition, and *usually* a DFU update will use
 * that. However, there are use cases for using custom pbf definitions (which
 * imply using a custom DFU bootloader). Thus, this code does NOT perform any
 * checks on the init packet (nor on the binary blob, for that matter).
 *
 * An instance of DfuUpdates might be shared by several operations using different
 * transports at the same time.
 *
 * The constructor expects an Array of Objects containing two `Uint8Arrays`. `updates` is an
 * Array of `update`s, and each `update` is an Object of the form
 * `{ initPacket: Uint8Array, firmwareImage: Uint8Array }`.
 *
 */
class DfuUpdates {
	constructor(updates) {
		this.updates = updates || [];
		// FIXME: Perform extra sanity checks, check types of the "updates" array.
	}

	/**
	 * Instantiates a set of DfuUpdates given the *path* of a .zip file.
	 * That .zip file is expected to have been created by nrfutil, having
	 * a valid manifest.
	 *
	 * This requires your environment to have access to the local filesystem.
	 * (i.e. works in nodejs, not in a web browser)
	 *
	 * @param {String} path The full file path to the .zip file
	 * @return {Promise} A Promise to an instance of DfuUpdates
	 */
	static fromZipFilePath(path) {
		return new Promise((res, rej) => {
			fs.readFile(path, (err, data) => {
				if (err) {
					return rej(err);
				}
				return res(this.fromZipFile(data));
			});
		});
	}

	/**
	 * Instantiates a set of DfuUpdates given the *contents* of a .zip file,
	 * as an ArrayBuffer, a Uint8Array, Buffer, Blob, or other data type accepted by
	 * [JSZip](https://stuk.github.io/jszip/documentation/api_jszip/load_async.html).
	 * That .zip file is expected to have been created by nrfutil, having
	 * a valid manifest.
	 *
	 * @param {String} zipBytes The full file path to the .zip file
	 * @return {Promise} A Promise to an instance of DfuUpdates
	 */
	static fromZipFile(zipBytes) {
		return new JSZip().loadAsync(zipBytes).then((zippedFiles) =>
			zippedFiles
				.file("manifest.json")
				.async("text")
				.then((manifestString) => {
					debug$4("Unzipped manifest: ", manifestString);

					return JSON.parse(manifestString).manifest;
				})
				.then((manifestJson) => {
					// The manifest should have up to 2 properties along
					// "softdevice", "bootloader", "softdevice_bootloader",
					// or "application". At least that's what the standard
					// Nordic DFU does, but nothing stops other implementations
					// and more types of payload. So we don't check for this.

					debug$4("Parsed manifest:", manifestJson);

					const updates = Object.entries(manifestJson).map(([, updateJson]) => {
						const initPacketPromise = zippedFiles.file(updateJson.dat_file).async("uint8array");
						const firmwareImagePromise = zippedFiles.file(updateJson.bin_file).async("uint8array");

						return Promise.all([initPacketPromise, firmwareImagePromise]).then(
							([initPacketBytes, firmwareImageBytes]) => ({
								initPacket: initPacketBytes,
								firmwareImage: firmwareImageBytes,
							})
						);
					});

					return Promise.all(updates).then((resolvedUpdates) => new DfuUpdates(resolvedUpdates));
				})
		);
	}
}

/*
The MIT License (MIT)

Copyright 2014 Alex Gorbatchev

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
let castToBytes;

if (typeof Uint8Array !== "undefined" && Uint8Array.from && typeof TextDecoder !== "undefined") {
	const utf8Decoder = new TextDecoder("utf-8");

	castToBytes = (arr) => {
		if (arr instanceof Uint8Array) {
			return arr;
		}
		if (typeof arr === "string") {
			return utf8Decoder(arr);
		}
		return Uint8Array.from(arr);
	};
} else {
	castToBytes =
		Buffer.from && Buffer.alloc && Buffer.allocUnsafe && Buffer.allocUnsafeSlow
			? (arr) => (Buffer.isBuffer(arr) ? arr : Buffer.from(arr))
			: (arr) => (Buffer.isBuffer(arr) ? arr : new Buffer(arr)); // support for Node < 5.10
}

function defineCrc(model, calc) {
	// eslint-disable-next-line no-bitwise
	const fn = (buf, previous) => calc(castToBytes(buf), previous) >>> 0;
	fn.signed = calc;
	fn.unsigned = fn;
	fn.model = model;

	return fn;
}

/*
The MIT License (MIT)

Copyright 2014 Alex Gorbatchev

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/


// Generated by `./pycrc.py --algorithm=table-driven --model=crc-32 --generate=c`
let TABLE = [
	0x00000000, 0x77073096, 0xee0e612c, 0x990951ba, 0x076dc419, 0x706af48f, 0xe963a535, 0x9e6495a3, 0x0edb8832,
	0x79dcb8a4, 0xe0d5e91e, 0x97d2d988, 0x09b64c2b, 0x7eb17cbd, 0xe7b82d07, 0x90bf1d91, 0x1db71064, 0x6ab020f2,
	0xf3b97148, 0x84be41de, 0x1adad47d, 0x6ddde4eb, 0xf4d4b551, 0x83d385c7, 0x136c9856, 0x646ba8c0, 0xfd62f97a,
	0x8a65c9ec, 0x14015c4f, 0x63066cd9, 0xfa0f3d63, 0x8d080df5, 0x3b6e20c8, 0x4c69105e, 0xd56041e4, 0xa2677172,
	0x3c03e4d1, 0x4b04d447, 0xd20d85fd, 0xa50ab56b, 0x35b5a8fa, 0x42b2986c, 0xdbbbc9d6, 0xacbcf940, 0x32d86ce3,
	0x45df5c75, 0xdcd60dcf, 0xabd13d59, 0x26d930ac, 0x51de003a, 0xc8d75180, 0xbfd06116, 0x21b4f4b5, 0x56b3c423,
	0xcfba9599, 0xb8bda50f, 0x2802b89e, 0x5f058808, 0xc60cd9b2, 0xb10be924, 0x2f6f7c87, 0x58684c11, 0xc1611dab,
	0xb6662d3d, 0x76dc4190, 0x01db7106, 0x98d220bc, 0xefd5102a, 0x71b18589, 0x06b6b51f, 0x9fbfe4a5, 0xe8b8d433,
	0x7807c9a2, 0x0f00f934, 0x9609a88e, 0xe10e9818, 0x7f6a0dbb, 0x086d3d2d, 0x91646c97, 0xe6635c01, 0x6b6b51f4,
	0x1c6c6162, 0x856530d8, 0xf262004e, 0x6c0695ed, 0x1b01a57b, 0x8208f4c1, 0xf50fc457, 0x65b0d9c6, 0x12b7e950,
	0x8bbeb8ea, 0xfcb9887c, 0x62dd1ddf, 0x15da2d49, 0x8cd37cf3, 0xfbd44c65, 0x4db26158, 0x3ab551ce, 0xa3bc0074,
	0xd4bb30e2, 0x4adfa541, 0x3dd895d7, 0xa4d1c46d, 0xd3d6f4fb, 0x4369e96a, 0x346ed9fc, 0xad678846, 0xda60b8d0,
	0x44042d73, 0x33031de5, 0xaa0a4c5f, 0xdd0d7cc9, 0x5005713c, 0x270241aa, 0xbe0b1010, 0xc90c2086, 0x5768b525,
	0x206f85b3, 0xb966d409, 0xce61e49f, 0x5edef90e, 0x29d9c998, 0xb0d09822, 0xc7d7a8b4, 0x59b33d17, 0x2eb40d81,
	0xb7bd5c3b, 0xc0ba6cad, 0xedb88320, 0x9abfb3b6, 0x03b6e20c, 0x74b1d29a, 0xead54739, 0x9dd277af, 0x04db2615,
	0x73dc1683, 0xe3630b12, 0x94643b84, 0x0d6d6a3e, 0x7a6a5aa8, 0xe40ecf0b, 0x9309ff9d, 0x0a00ae27, 0x7d079eb1,
	0xf00f9344, 0x8708a3d2, 0x1e01f268, 0x6906c2fe, 0xf762575d, 0x806567cb, 0x196c3671, 0x6e6b06e7, 0xfed41b76,
	0x89d32be0, 0x10da7a5a, 0x67dd4acc, 0xf9b9df6f, 0x8ebeeff9, 0x17b7be43, 0x60b08ed5, 0xd6d6a3e8, 0xa1d1937e,
	0x38d8c2c4, 0x4fdff252, 0xd1bb67f1, 0xa6bc5767, 0x3fb506dd, 0x48b2364b, 0xd80d2bda, 0xaf0a1b4c, 0x36034af6,
	0x41047a60, 0xdf60efc3, 0xa867df55, 0x316e8eef, 0x4669be79, 0xcb61b38c, 0xbc66831a, 0x256fd2a0, 0x5268e236,
	0xcc0c7795, 0xbb0b4703, 0x220216b9, 0x5505262f, 0xc5ba3bbe, 0xb2bd0b28, 0x2bb45a92, 0x5cb36a04, 0xc2d7ffa7,
	0xb5d0cf31, 0x2cd99e8b, 0x5bdeae1d, 0x9b64c2b0, 0xec63f226, 0x756aa39c, 0x026d930a, 0x9c0906a9, 0xeb0e363f,
	0x72076785, 0x05005713, 0x95bf4a82, 0xe2b87a14, 0x7bb12bae, 0x0cb61b38, 0x92d28e9b, 0xe5d5be0d, 0x7cdcefb7,
	0x0bdbdf21, 0x86d3d2d4, 0xf1d4e242, 0x68ddb3f8, 0x1fda836e, 0x81be16cd, 0xf6b9265b, 0x6fb077e1, 0x18b74777,
	0x88085ae6, 0xff0f6a70, 0x66063bca, 0x11010b5c, 0x8f659eff, 0xf862ae69, 0x616bffd3, 0x166ccf45, 0xa00ae278,
	0xd70dd2ee, 0x4e048354, 0x3903b3c2, 0xa7672661, 0xd06016f7, 0x4969474d, 0x3e6e77db, 0xaed16a4a, 0xd9d65adc,
	0x40df0b66, 0x37d83bf0, 0xa9bcae53, 0xdebb9ec5, 0x47b2cf7f, 0x30b5ffe9, 0xbdbdf21c, 0xcabac28a, 0x53b39330,
	0x24b4a3a6, 0xbad03605, 0xcdd70693, 0x54de5729, 0x23d967bf, 0xb3667a2e, 0xc4614ab8, 0x5d681b02, 0x2a6f2b94,
	0xb40bbe37, 0xc30c8ea1, 0x5a05df1b, 0x2d02ef8d,
];

if (typeof Int32Array !== "undefined") TABLE = new Int32Array(TABLE);

/* eslint-disable no-bitwise */

const crc32 = defineCrc("crc-32", (buf, previous) => {
	let crc = previous === 0 ? 0 : ~~previous ^ -1;

	for (let index = 0; index < buf.length; index += 1) {
		const byte = buf[index];
		crc = TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
	}

	return crc ^ -1;
});

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


const debug$3 = Debug("dfu:error");

const ErrorCode = {
	// Error message types
	ERROR_MESSAGE: 0x00,
	ERROR_MESSAGE_RSP: 0x01,
	ERROR_MESSAGE_EXT: 0x02,

	// Error code for DfuAbstractTransport
	ERROR_CAN_NOT_INIT_ABSTRACT_TRANSPORT: 0x0000,
	ERROR_PRE_DFU_INTERRUPTED: 0x0001,
	ERROR_UNEXPECTED_BYTES: 0x0002,
	ERROR_CRC_MISMATCH: 0x0003,
	ERROR_TOO_MANY_WRITE_FAILURES: 0x0004,

	// Error code for DfuTransportPrn
	ERROR_CAN_NOT_INIT_PRN_TRANSPORT: 0x0010,
	ERROR_CAN_NOT_USE_HIGHER_PRN: 0x0011,
	ERROR_READ_CONFLICT: 0x0012,
	ERROR_TIMEOUT_READING_SERIAL: 0x0013,
	ERROR_RECEIVE_TWO_MESSAGES: 0x0014,
	ERROR_RESPONSE_NOT_START_WITH_0x60: 0x0015,
	ERROR_ASSERT_EMPTY_RESPONSE: 0x0016,
	ERROR_UNEXPECTED_RESPONSE_OPCODE: 0x0017,
	ERROR_UNEXPECTED_RESPONSE_BYTES: 0x0018,

	// Error code for DfuTransportSink
	ERROR_MUST_HAVE_PAYLOAD: 0x0031,
	ERROR_INVOKED_MISMATCHED_CRC32: 0x0032,
	ERROR_MORE_BYTES_THAN_CHUNK_SIZE: 0x0033,
	ERROR_INVALID_PAYLOAD_TYPE: 0x0034,

	// Error code for DfuTransportNoble
	ERROR_CAN_NOT_DISCOVER_DFU_CONTROL: 0x0051,
	ERROR_TIMEOUT_FETCHING_CHARACTERISTICS: 0x0052,
	ERROR_CAN_NOT_SUBSCRIBE_CHANGES: 0x0053,
	ERROR_TIMEOUT_JUMPING_TO_BOOTLOADER: 0x0054,
	ERROR_TIMEOUT_SCANNING_NEW_PERIPHERAL: 0x0055,

	// Error code for DfuTransportSerial(including slow and usb)
	ERROR_UNKNOWN_FIRMWARE_TYPE: 0x0071,
	ERROR_UNABLE_FIND_PORT: 0x0072,

	// Error code for response error messages
	ERROR_RSP_INVALID: 0x0100,
	ERROR_RSP_SUCCESS: 0x0101,
	ERROR_RSP_OP_CODE_NOT_SUPPORTED: 0x0102,
	ERROR_RSP_INVALID_PARAMETER: 0x0103,
	ERROR_RSP_INSUFFICIENT_RESOURCES: 0x0104,
	ERROR_RSP_INVALID_OBJECT: 0x0105,
	ERROR_RSP_UNSUPPORTED_TYPE: 0x0107,
	ERROR_RSP_OPERATION_NOT_PERMITTED: 0x0108,
	ERROR_RSP_OPERATION_FAILED: 0x010a,
	ERROR_RSP_EXT_ERROR: 0x010b,

	// Error code for extended error messages
	ERROR_EXT_NO_ERROR: 0x0200,
	ERROR_EXT_INVALID_ERROR_CODE: 0x0201,
	ERROR_EXT_WRONG_COMMAND_FORMAT: 0x0202,
	ERROR_EXT_UNKNOWN_COMMAND: 0x0203,
	ERROR_EXT_INIT_COMMAND_INVALID: 0x0204,
	ERROR_EXT_FW_VERSION_FAILURE: 0x0205,
	ERROR_EXT_HW_VERSION_FAILURE: 0x0206,
	ERROR_EXT_SD_VERSION_FAILURE: 0x0207,
	ERROR_EXT_SIGNATURE_MISSING: 0x0208,
	ERROR_EXT_WRONG_HASH_TYPE: 0x0209,
	ERROR_EXT_HASH_FAILED: 0x020a,
	ERROR_EXT_WRONG_SIGNATURE_TYPE: 0x020b,
	ERROR_EXT_VERIFICATION_FAILED: 0x020c,
	ERROR_EXT_INSUFFICIENT_SPACE: 0x020d,
	ERROR_EXT_FW_ALREADY_PRESENT: 0x020e,
};

// Error types for errorMessages, responseErrorMessages and extendedErrorMessages
const ErrorTypes = {
	[ErrorCode.ERROR_MESSAGE]: "Error message",
	[ErrorCode.ERROR_MESSAGE_RSP]: "Error message for known response code from DFU target",
	[ErrorCode.ERROR_MESSAGE_EXT]: "Error message for known extended error code from DFU target",
};

// Error messages for pc-nrf-dfu-js
const ErrorMessages = {
	[ErrorCode.ERROR_CAN_NOT_INIT_ABSTRACT_TRANSPORT]:
		"Cannot instantiate DfuAbstractTransport, use a concrete subclass instead.",
	[ErrorCode.ERROR_PRE_DFU_INTERRUPTED]:
		"A previous DFU process was interrupted, and it was left in such a state that cannot be continued. Please perform a DFU procedure disabling continuation.",
	[ErrorCode.ERROR_UNEXPECTED_BYTES]: "Unexpected bytes to be sent.",
	[ErrorCode.ERROR_CRC_MISMATCH]: "CRC mismatches.",
	[ErrorCode.ERROR_TOO_MANY_WRITE_FAILURES]: "Too many write failures.",
	[ErrorCode.ERROR_CAN_NOT_INIT_PRN_TRANSPORT]:
		"Cannot instantiate DfuTransportPrn, use a concrete subclass instead.",
	[ErrorCode.ERROR_CAN_NOT_USE_HIGHER_PRN]: "DFU procotol cannot use a PRN higher than 0xFFFF.",
	[ErrorCode.ERROR_READ_CONFLICT]: "DFU transport tried to read() while another read() was still waiting",
	[ErrorCode.ERROR_TIMEOUT_READING_SERIAL]:
		"Timeout while reading from serial transport. See https://github.com/NordicSemiconductor/pc-nrfconnect-launcher/blob/master/doc/serial-timeout-troubleshoot.md",
	[ErrorCode.ERROR_RECEIVE_TWO_MESSAGES]: "DFU transport received two messages at once",
	[ErrorCode.ERROR_RESPONSE_NOT_START_WITH_0x60]: "Response from DFU target did not start with 0x60",
	[ErrorCode.ERROR_ASSERT_EMPTY_RESPONSE]: "Tried to assert an empty parsed response",
	[ErrorCode.ERROR_UNEXPECTED_RESPONSE_OPCODE]: "Unexpected opcode in response",
	[ErrorCode.ERROR_UNEXPECTED_RESPONSE_BYTES]: "Unexpected bytes in response",
	[ErrorCode.ERROR_MUST_HAVE_PAYLOAD]: "Must create/select a payload type first.",
	[ErrorCode.ERROR_INVOKED_MISMATCHED_CRC32]: "Invoked with a mismatched CRC32 checksum.",
	[ErrorCode.ERROR_MORE_BYTES_THAN_CHUNK_SIZE]: "Tried to push more bytes to a chunk than the chunk size.",
	[ErrorCode.ERROR_INVALID_PAYLOAD_TYPE]: "Tried to select invalid payload type. Valid types are 0x01 and 0x02.",
	[ErrorCode.ERROR_CAN_NOT_DISCOVER_DFU_CONTROL]: "Could not discover DFU control and packet characteristics",
	[ErrorCode.ERROR_TIMEOUT_FETCHING_CHARACTERISTICS]: "Timeout while fetching characteristics from BLE peripheral",
	[ErrorCode.ERROR_CAN_NOT_SUBSCRIBE_CHANGES]: "Could not subscribe to changes of the control characteristics",
	[ErrorCode.ERROR_TIMEOUT_JUMPING_TO_BOOTLOADER]: "Timeout while jumping to bootloader",
	[ErrorCode.ERROR_TIMEOUT_SCANNING_NEW_PERIPHERAL]: "Timeout while scanning for new peripheral",
	[ErrorCode.ERROR_UNKNOWN_FIRMWARE_TYPE]: "Unkown firmware image type",
	[ErrorCode.ERROR_UNABLE_FIND_PORT]: "Unable to find port.",
};

// Error messages for the known response codes.
// See http://infocenter.nordicsemi.com/index.jsp?topic=%2Fcom.nordic.infocenter.sdk5.v14.2.0%2Fgroup__nrf__dfu__rescodes.html
// as well as the response codes at
// http://infocenter.nordicsemi.com/index.jsp?topic=%2Fcom.nordic.infocenter.sdk5.v14.2.0%2Flib_dfu_transport_serial.html

const ResponseErrorMessages = {
	[ErrorCode.ERROR_RSP_INVALID]: "Missing or malformed opcode.",
	//  0x01: success
	[ErrorCode.ERROR_RSP_OP_CODE_NOT_SUPPORTED]: "Opcode unknown or not supported.",
	[ErrorCode.ERROR_RSP_INVALID_PARAMETER]: "A parameter for the opcode was missing.",
	[ErrorCode.ERROR_RSP_INSUFFICIENT_RESOURCES]: "Not enough memory for the data object.",
	// 0x05 should not happen. Bootloaders starting from late 2017 and later will
	// use extended error codes instead.
	[ErrorCode.ERROR_RSP_INVALID_OBJECT]:
		"The data object didn't match firmware/hardware, or missing crypto signature, or malformed protocol buffer, or command parse failed.",
	//  0x06: missing from the spec
	[ErrorCode.ERROR_RSP_UNSUPPORTED_TYPE]: "Unsupported object type for create/read operation.",
	[ErrorCode.ERROR_RSP_OPERATION_NOT_PERMITTED]: "Cannot allow this operation in the current DFU state.",
	//  0x09: missing from the spec
	[ErrorCode.ERROR_RSP_OPERATION_FAILED]: "Operation failed.",
	//  0x0B: extended error, will read next byte from the response and use it as extended error code
};

// Error messages for the known extended error codes.
// See http://infocenter.nordicsemi.com/index.jsp?topic=%2Fcom.nordic.infocenter.sdk5.v14.2.0%2Fgroup__sdk__nrf__dfu__transport.html
const ExtendedErrorMessages = {
	[ErrorCode.ERROR_EXT_NO_ERROR]: "An error happened, but its extended error code hasn't been set.",
	[ErrorCode.ERROR_EXT_INVALID_ERROR_CODE]: "An error happened, but its extended error code is incorrect.",
	// Extended 0x02 should never happen, because responses 0x02 and 0x03
	// should cover all possible incorrect inputs
	[ErrorCode.ERROR_EXT_WRONG_COMMAND_FORMAT]: "The format of the command was incorrect.",
	[ErrorCode.ERROR_EXT_UNKNOWN_COMMAND]: "Command successfully parsed, but it is not supported or unknown.",
	[ErrorCode.ERROR_EXT_INIT_COMMAND_INVALID]:
		"The init command is invalid. The init packet either has an invalid update type or it is missing required fields for the update type (for example, the init packet for a SoftDevice update is missing the SoftDevice size field).",
	[ErrorCode.ERROR_EXT_FW_VERSION_FAILURE]:
		"The firmware version is too low. For an application, the version must be greater than the current application. For a bootloader, it must be greater than or equal to the current version. This requirement prevents downgrade attacks.",
	[ErrorCode.ERROR_EXT_HW_VERSION_FAILURE]:
		"The hardware version of the device does not match the required hardware version for the update.",
	[ErrorCode.ERROR_EXT_SD_VERSION_FAILURE]:
		"The array of supported SoftDevices for the update does not contain the FWID of the current SoftDevice.",
	[ErrorCode.ERROR_EXT_SIGNATURE_MISSING]:
		"The init packet does not contain a signature. This bootloader requires DFU updates to be signed.",
	[ErrorCode.ERROR_EXT_WRONG_HASH_TYPE]:
		"The hash type that is specified by the init packet is not supported by the DFU bootloader.",
	[ErrorCode.ERROR_EXT_HASH_FAILED]: "The hash of the firmware image cannot be calculated.",
	[ErrorCode.ERROR_EXT_WRONG_SIGNATURE_TYPE]:
		"The type of the signature is unknown or not supported by the DFU bootloader.",
	[ErrorCode.ERROR_EXT_VERIFICATION_FAILED]:
		"The hash of the received firmware image does not match the hash in the init packet.",
	[ErrorCode.ERROR_EXT_INSUFFICIENT_SPACE]: "The available space on the device is insufficient to hold the firmware.",
	[ErrorCode.ERROR_EXT_FW_ALREADY_PRESENT]: "The requested firmware to update was already present on the system.",
};

/**
 * Error class for DFU
 */
class DfuError extends Error {
	constructor(code, message = undefined) {
		super();
		this.code = code;
		this.message = DfuError.getErrorMessage(code);
		if (message) {
			this.message += ` ${message}`;
		}
	}

	static getErrorMessage(code) {
		let errorMsg;
		const errorType = code >> 8;

		debug$3(`Error type is ${errorType}.`);

		errorMsg = ErrorTypes[errorType];
		if (!errorMsg) {
			throw new Error("Error type is unknown.");
		}

		errorMsg += ": ";
		switch (errorType) {
			case 0x00:
				debug$3("This is an error message.");
				errorMsg += ErrorMessages[code];
				break;
			case 0x01:
				debug$3("This is a response error message.");
				errorMsg += ResponseErrorMessages[code];
				break;
			case 0x02:
				debug$3("This is an extended error message.");
				errorMsg += ExtendedErrorMessages[code];
				break;
			default:
				debug$3("This is an unknown error message.");
		}

		return errorMsg;
	}
}

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

const debug$2 = Debug("dfu:transport");

/**
 * Implements the logic common to all transports, but not the transport itself.
 *
 * It says "Abstract" in the class name, so do not instantiate directly. Subclass,
 * and complete the functionality of the needed methods with the actual transport
 * logic.
 */
class DfuAbstractTransport extends EventEmitter {
	constructor() {
		super();
		if (this.constructor === DfuAbstractTransport) {
			throw new DfuError(ErrorCode.ERROR_CAN_NOT_INIT_ABSTRACT_TRANSPORT);
		}
	}

	// Restarts the DFU procedure by sending a create command of
	// type 1 (init payload / "command object").
	// By default, CRC checks are done in order to continue an interrupted
	// transfer. Calling this before a sendInitPacket() will forcefully
	// re-send everything.
	restart() {
		debug$2("Forcefully restarting DFU procedure");
		return this.createObject(1, 0x10);
	}

	// Abort the DFU procedure, which means exiting the bootloader mode
	// and trying to switch back to the app mode
	abort() {
		debug$2("Exit Bootloader Mode");
		return this.abortObject();
	}

	// Given a Uint8Array, sends it as an init payload / "command object".
	// Returns a Promise.
	sendInitPacket(bytes) {
		return this.sendPayload(0x01, bytes);
	}

	// Given a Uint8Array, sends it as the main payload / "data object".
	// Returns a Promise.
	sendFirmwareImage(bytes) {
		return this.sendPayload(0x02, bytes);
	}

	// Sends either a init payload ("init packet"/"command object") or a data payload
	// ("firmware image"/"data objects")
	sendPayload(type, bytes, resumeAtChunkBoundary = false) {
		debug$2(`Sending payload of type ${type}`);
		return this.selectObject(type).then(([offset, crcSoFar, chunkSize]) => {
			if (offset !== 0) {
				debug$2(`Offset is not zero (${offset}). Checking if graceful continuation is possible.`);
				const crc = crc32(bytes.subarray(0, offset));

				if (crc === crcSoFar) {
					debug$2("CRC match");
					if (offset === bytes.length) {
						debug$2("Payload already transferred sucessfully, sending execute command just in case.");

						// Send an exec command, just in case the previous connection broke
						// just before the exec command. An extra exec command will have no
						// effect.
						return this.executeObject(type, chunkSize);
					}
					if (offset % chunkSize === 0 && !resumeAtChunkBoundary) {
						// Edge case: when an exact multiple of the chunk size has
						// been transferred, the host side cannot be sure if the last
						// chunk has been marked as ready ("executed") or not.
						// Fortunately, if an "execute" command is sent right after
						// another "execute" command, the second one will do nothing
						// and yet receive an "OK" response code.
						debug$2(
							"Edge case: payload transferred up to page boundary; previous execute command might have been lost, re-sending."
						);

						return this.executeObject(type, chunkSize).then(() => this.sendPayload(type, bytes, true));
					}
					debug$2(`Payload partially transferred sucessfully, continuing from offset ${offset}.`);

					// Send the remainder of a half-finished chunk
					const end = Math.min(bytes.length, offset + chunkSize - (offset % chunkSize));

					return this.sendAndExecutePayloadChunk(type, bytes, offset, end, chunkSize, crc);
				}

				// Note that these are CRC mismatches at a chunk level, not at a
				// transport level. Individual transports might decide to roll back
				// parts of a chunk (re-creating it) on PRN CRC failures.
				// But here it means that there is a CRC mismatch while trying to
				// continue an interrupted DFU, and the behaviour in this case is to panic.
				debug$2(`CRC mismatch: expected/actual 0x${crc.toString(16)}/0x${crcSoFar.toString(16)}`);

				return Promise.reject(new DfuError(ErrorCode.ERROR_PRE_DFU_INTERRUPTED));
			}
			const end = Math.min(bytes.length, chunkSize);

			return this.createObject(type, end).then(() =>
				this.sendAndExecutePayloadChunk(type, bytes, 0, end, chunkSize)
			);
		});
	}

	// Sends *one* chunk.
	// Sending a chunk involves:
	// - (Creating a payload chunk) (this is done *before* sending the current chunk)
	// - Writing the payload chunk (wire implementation might perform fragmentation)
	// - Check CRC32 and offset of payload so far
	// - Execute the payload chunk (target might write a flash page)
	sendAndExecutePayloadChunk(type, bytes, start, end, chunkSize, crcSoFar = undefined) {
		return this.sendPayloadChunk(type, bytes, start, end, chunkSize, crcSoFar)
			.then(() => this.executeObject())
			.then(() => {
				if (end >= bytes.length) {
					debug$2(`Sent ${end} bytes, this payload type is finished`);
					return Promise.resolve();
				}
				// Send next chunk
				debug$2(`Sent ${end} bytes, not finished yet (until ${bytes.length})`);
				const nextEnd = Math.min(bytes.length, end + chunkSize);
				//emit progress
				this.emit("progress", { sent: end, total: bytes.length });
				return this.createObject(type, nextEnd - end).then(() =>
					this.sendAndExecutePayloadChunk(type, bytes, end, nextEnd, chunkSize, crc32(bytes.subarray(0, end)))
				);
			});
	}

	// Sends one payload chunk, retrying if necessary.
	// This is done without checksums nor sending the "execute" command. The reason
	// for splitting this code apart is that retrying a chunk is easier when abstracting away
	// the "execute" and "next chunk" logic
	sendPayloadChunk(type, bytes, start, end, chunkSize, crcSoFar = undefined, retries = 0) {
		const subarray = bytes.subarray(start, end);
		const crcAtChunkEnd = crc32(subarray, crcSoFar);

		return this.writeObject(subarray, crcSoFar, start)
			.then(() => {
				debug$2("Payload type fully transferred, requesting explicit checksum");
				return this.crcObject(end, crcAtChunkEnd);
			})
			.then(([offset, crc]) => {
				if (offset !== end) {
					throw new DfuError(
						ErrorCode.ERROR_UNEXPECTED_BYTES,
						`Expected ${end} bytes to have been sent, actual is ${offset} bytes.`
					);
				}

				if (crcAtChunkEnd !== crc) {
					throw new DfuError(
						ErrorCode.ERROR_CRC_MISMATCH,
						`CRC mismatch after ${end} bytes have been sent: expected ${crcAtChunkEnd}, got ${crc}.`
					);
				} else {
					debug$2(`Explicit checksum OK at ${end} bytes`);
				}
			})
			.catch((err) => {
				if (retries >= 5) {
					return Promise.reject(
						new DfuError(ErrorCode.ERROR_TOO_MANY_WRITE_FAILURES, `Last failure: ${err}`)
					);
				}
				debug$2(
					`Chunk write failed (${err}) Re-sending the whole chunk starting at ${start}. Times retried: ${retries}`
				);

				// FIXME: Instead of re-creating the whole chunk, select the payload
				// type again and check the CRC so far.

				const newStart = start - (start % chunkSize);
				// Rewind to the start of the block
				const rewoundCrc = newStart === 0 ? undefined : crc32(bytes.subarray(0, newStart));

				return this.createObject(type, end - start).then(() =>
					this.sendPayloadChunk(type, bytes, newStart, end, chunkSize, rewoundCrc, retries + 1)
				);
			});
	}

	// The following 5 methods have a 1-to-1 mapping to the 5 DFU requests
	// documented at http://infocenter.nordicsemi.com/index.jsp?topic=%2Fcom.nordic.infocenter.sdk5.v14.0.0%2Flib_dfu_transport.html
	// These are meant as abstract methods, meaning they do nothing and subclasses
	// must provide an implementation.

	/* eslint-disable class-methods-use-this, no-unused-vars */

	// Allocate space for a new payload chunk. Resets the progress
	// since the last Execute command, and selects the newly created object.
	// Must return a Promise
	// Actual implementation must be provided by concrete subclasses of DfuAbstractTransport.
	createObject(type, size) {}

	// Fill the space previously allocated with createObject() with the given bytes.
	// Also receives the absolute offset and CRC32 so far, as some wire
	// implementations perform extra CRC32 checks as the fragmented data is being
	// checksummed (and the return value for those checks involves both the absolute
	// offset and the CRC32 value). Note that the CRC and offset are not part of the
	// SDK implementation.
	// Must return a Promise to an array of [offset, crc]
	// Actual implementation must be provided by concrete subclasses of DfuAbstractTransport.
	writeObject(bytes, crcSoFar, offsetSoFar) {}

	// Trigger a CRC calculation of the data sent so far.
	// Must return a Promise to an array of [offset, crc]
	// Actual implementation must be provided by concrete subclasses of DfuAbstractTransport.
	crcObject() {}

	// Marks payload chunk as fully sent. The target may write a page of flash memory and
	// prepare to receive the next chunk (if not all pages have been sent), or start
	// firmware postvalidation (if all pages have been sent).
	// Must return a Promise
	// Actual implementation must be provided by concrete subclasses of DfuAbstractTransport.
	executeObject() {}

	// Marks the last payload type as "active".
	// Returns a Promise to an array of [offset, crc, max chunk size].
	// The offset is *absolute* - it includes all chunks sent so far, and so can be several
	// times larger than the max chunk size.
	// Typically the chunk size will be the size of a page of flash memory.
	// Actual implementation must be provided by concrete subclasses of DfuAbstractTransport.
	selectObject(type) {}

	// Abort bootloader mode and try to switch back to app mode
	abortObject() {}
}

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


const debug$1 = Debug("dfu:prntransport");

/**
 * PRN-capable abstract DFU transport.
 *
 * This abstract class inherits from DfuAbstractTransport, and implements
 * PRN (Packet Receive Notification) and the splitting of a page of data
 * into smaller chunks.
 *
 * Both the Serial DFU and the BLE DFU protocols implement these common bits of
 * logic, but they do so in a lower level than the abstract 5-commands DFU protocol.
 */
class DfuTransportPrn extends DfuAbstractTransport {
	// The constructor takes the value for the PRN interval. It should be
	// provided by the concrete subclasses.
	constructor(packetReceiveNotification = 16) {
		super();

		if (this.constructor === DfuTransportPrn) {
			throw new DfuError(ErrorCode.ERROR_CAN_NOT_INIT_PRN_TRANSPORT);
		}

		if (packetReceiveNotification > 0xffff) {
			// Ensure it fits in 16 bits
			throw new DfuError(ErrorCode.ERROR_CAN_NOT_USE_HIGHER_PRN);
		}

		this.prn = packetReceiveNotification;

		// Store *one* message waitig to be read()
		this.lastReceivedPacket = undefined;

		// Store *one* reference to a read() callback function
		this.waitingForPacket = undefined;

		// Maximum Transmission Unit. The maximum amount of bytes that can be sent to a
		// writeData() call. Its value **must** be filled in by the concrete subclasses
		// before any data is sent.
		this.mtu = undefined;
	}

	// The following are meant as abstract methods, meaning they do nothing and subclasses
	// must provide an implementation.

	/* eslint-disable class-methods-use-this, no-unused-vars */

	// Abstract method. Concrete subclasses shall implement sending the bytes
	// into the wire/air.
	// The bytes shall include an opcode and payload.
	writeCommand(bytes) {}

	// Abstract method. Concrete subclasses shall implement sending the bytes
	// into the wire/air.
	// The bytes are all data bytes. Subclasses are responsible for packing
	// this into a command (serial DFU) or sending them through the wire/air
	// through an alternate channel (BLE DFU)
	writeData(bytes) {}

	// Abstract method, called before any operation that would send bytes.
	// Concrete subclasses **must**:
	// - Check validity of the connection,
	// - Re-initialize connection if needed, including
	//   - Set up PRN
	//   - Request MTU (only if the transport has a variable MTU)
	// - Return a Promise whenever the connection is ready.
	ready() {}

	/* eslint-enable class-methods-use-this, no-unused-vars */

	// Requests a (decoded and) parsed packet/message, either a response
	// to a previous command or a PRN notification.
	// Returns a Promise to [opcode, Uint8Array].
	// Cannot have more than one pending request at any time.
	read() {
		if (this.waitingForPacket) {
			throw new DfuError(ErrorCode.ERROR_READ_CONFLICT);
		}

		if (this.lastReceivedPacket) {
			const packet = this.lastReceivedPacket;
			delete this.lastReceivedPacket;
			return Promise.resolve(packet);
		}

		// Store the callback so it can be called as soon as the wire packet is
		// ready. Add a 5sec timeout while we're at it; remove that timeout
		// when data is actually received.
		return new Promise((res, rej) => {
			let timeout;

			const readCallback = (data) => {
				clearTimeout(timeout);
				res(data);
			};

			timeout = setTimeout(() => {
				if (this.waitingForPacket && this.waitingForPacket === readCallback) {
					delete this.waitingForPacket;
				}
				rej(new DfuError(ErrorCode.ERROR_TIMEOUT_READING_SERIAL));
			}, 5000);

			this.waitingForPacket = readCallback;
		});
	}

	// Must be called when a (complete) packet/message is received, with the
	// (decoded) bytes of the entire packet/message. Either stores the packet
	// just received, or calls the pending read() callback to unlock it
	onData(bytes) {
		if (this.lastReceivedPacket) {
			throw new DfuError(ErrorCode.ERROR_RECEIVE_TWO_MESSAGES);
		}

		if (this.waitingForPacket) {
			const callback = this.waitingForPacket;
			delete this.waitingForPacket;
			return callback(this.parse(bytes));
		}

		this.lastReceivedPacket = this.parse(bytes);
		return undefined;
	}

	// Parses a received DFU response packet/message, does a couple of checks,
	// then returns an array of the form [opcode, payload] if the
	// operation was sucessful.
	// If there were any errors, returns a rejected Promise with an error message.
	parse(bytes) {
		// eslint-disable-line class-methods-use-this
		if (bytes[0] !== 0x60) {
			return Promise.reject(new DfuError(ErrorCode.ERROR_RESPONSE_NOT_START_WITH_0x60));
		}
		const opcode = bytes[1];
		const resultCode = bytes[2];
		if (resultCode === ErrorCode.ERROR_MESSAGE_RSP) {
			debug$1("Parsed DFU response packet: opcode ", opcode, ", payload: ", bytes.subarray(3));
			return Promise.resolve([opcode, bytes.subarray(3)]);
		}

		let errorCode;
		let errorStr;
		const extCode = ErrorCode.ERROR_RSP_EXT_ERROR - (ErrorCode.ERROR_MESSAGE_RSP << 8);
		const resultCodeRsp = (ErrorCode.ERROR_MESSAGE_RSP << 8) + resultCode;
		if (resultCodeRsp in ResponseErrorMessages) {
			errorCode = resultCodeRsp;
		} else if (resultCode === extCode) {
			const extendedErrorCode = bytes[3];
			const resultCodeExt = (ErrorCode.ERROR_MESSAGE_EXT << 8) + extendedErrorCode;
			if (resultCodeExt in ExtendedErrorMessages) {
				errorCode = resultCodeExt;
			} else {
				errorStr = `0x0B 0x${extendedErrorCode.toString(16)}`;
				errorCode = ErrorCode.ERROR_EXT_ERROR_CODE_UNKNOWN;
			}
		} else {
			errorStr = `0x${resultCode.toString(16)}`;
			errorCode = ErrorCode.ERROR_RSP_OPCODE_UNKNOWN;
		}

		debug$1(errorCode, errorStr);
		return Promise.reject(new DfuError(errorCode, errorStr));
	}

	// Returns a *function* that checks a [opcode, bytes] parameter against the given
	// opcode and byte length, and returns only the bytes.
	// If the opcode is different, or the payload length is different, an error is thrown.
	assertPacket(expectedOpcode, expectedLength) {
		// eslint-disable-line class-methods-use-this
		return (response) => {
			if (!response) {
				debug$1("Tried to assert an empty parsed response!");
				debug$1("response: ", response);
				throw new DfuError(ErrorCode.ERROR_ASSERT_EMPTY_RESPONSE);
			}
			const [opcode, bytes] = response;

			if (opcode !== expectedOpcode) {
				throw new DfuError(
					ErrorCode.ERROR_UNEXPECTED_RESPONSE_OPCODE,
					`Expected opcode ${expectedOpcode}, got ${opcode} instead.`
				);
			}

			if (bytes.length !== expectedLength) {
				throw new DfuError(
					ErrorCode.ERROR_UNEXPECTED_RESPONSE_BYTES,
					`Expected ${expectedLength} bytes in response to opcode ${expectedOpcode}, got ${bytes.length} bytes instead.`
				);
			}

			return bytes;
		};
	}

	createObject(type, size) {
		debug$1(`CreateObject type ${type}, size ${size}`);

		return this.ready().then(() =>
			this.writeCommand(
				new Uint8Array([
					0x01, // "Create object" opcode
					type,
					size & 0xff,
					(size >> 8) & 0xff,
					(size >> 16) & 0xff,
					(size >> 24) & 0xff,
				])
			)
				.then(this.read.bind(this))
				.then(this.assertPacket(0x01, 0))
		);
	}

	writeObject(bytes, crcSoFar, offsetSoFar) {
		debug$1("WriteObject");
		return this.ready().then(() => this.writeObjectPiece(bytes, crcSoFar, offsetSoFar, 0));
	}

	// Sends *one* write operation (with up to this.mtu bytes of un-encoded data)
	// Triggers a counter-based PRN confirmation
	writeObjectPiece(bytes, crcSoFar, offsetSoFar, prnCount) {
		return this.ready().then(() => {
			const sendLength = Math.min(this.mtu, bytes.length);
			//             const sendLength = 1; // DEBUG

			const bytesToSend = bytes.subarray(0, sendLength);
			//             const packet = new Uint8Array(sendLength + 1);
			//             packet.set([0x08], 0);    // "Write" opcode
			//             packet.set(bytesToSend, 1);

			const newOffsetSoFar = offsetSoFar + sendLength;
			const newCrcSoFar = crc32(bytesToSend, crcSoFar);
			let newPrnCount = prnCount + 1;

			return this.writeData(bytesToSend)
				.then(() => {
					if (this.prn > 0 && newPrnCount >= this.prn) {
						debug$1("PRN hit, expecting CRC");
						// Expect a CRC due to PRN
						newPrnCount = 0;
						return this.readCrc().then(([offset, crc]) => {
							if (newOffsetSoFar === offset && newCrcSoFar === crc) {
								debug$1(
									`PRN checksum OK at offset ${offset} (0x${offset.toString(16)}) (0x${crc.toString(
										16
									)})`
								);
								return undefined;
							}
							return Promise.reject(
								new DfuError(
									ErrorCode.ERROR_CRC_MISMATCH,
									`CRC mismatch during PRN at byte ${offset}/${newOffsetSoFar}, expected 0x${newCrcSoFar.toString(
										16
									)} but got 0x${crc.toString(16)} instead`
								)
							);
						});
					}
					return undefined;
				})
				.then(() => {
					if (sendLength < bytes.length) {
						// Send more stuff
						return this.writeObjectPiece(
							bytes.subarray(sendLength),
							newCrcSoFar,
							newOffsetSoFar,
							newPrnCount
						);
					}
					return [newOffsetSoFar, newCrcSoFar];
				});
		});
	}

	// Reads a PRN CRC response and returns the offset/CRC pair
	readCrc() {
		return this.ready().then(() =>
			this.read()
				.then(this.assertPacket(0x03, 8))
				.then((bytes) => {
					// Decode little-endian fields, by using a DataView with the
					// same buffer *and* offset than the Uint8Array for the packet payload
					const bytesView = new DataView(bytes.buffer, bytes.byteOffset);
					const offset = bytesView.getUint32(0, true);
					const crc = bytesView.getUint32(4, true);

					// // DEBUG: Once in every 11 CRC responses, apply a XOR to the CRC
					// // to make it look like something has failed.

					// if ((this._crcFailCounter = (this._crcFailCounter || 0) + 1) >= 11) {
					//  // if (Math.random() < 0.05) {
					//     debug('DEBUG: mangling CRC response to make it look like a failure');
					//     this._crcFailCounter = 0;
					//     return [offset, Math.abs(crc - 0x1111)];
					// }

					return [offset, crc];
				})
		);
	}

	crcObject() {
		debug$1("Request CRC explicitly");

		return this.ready().then(() =>
			this.writeCommand(
				new Uint8Array([
					0x03, // "CRC" opcode
				])
			).then(this.readCrc.bind(this))
		);
	}

	executeObject() {
		debug$1("Execute (mark payload chunk as ready)");
		return this.ready().then(() =>
			this.writeCommand(
				new Uint8Array([
					0x04, // "Execute" opcode
				])
			)
				.then(this.read.bind(this))
				.then(this.assertPacket(0x04, 0))
		);
	}

	selectObject(type) {
		debug$1("Select (report max size and current offset/crc)");

		return this.ready().then(() =>
			this.writeCommand(
				new Uint8Array([
					0x06, // "Select object" opcode
					type,
				])
			)
				.then(this.read.bind(this))
				.then(this.assertPacket(0x06, 12))
				.then((bytes) => {
					// Decode little-endian fields
					const bytesView = new DataView(bytes.buffer);
					const chunkSize = bytesView.getUint32(bytes.byteOffset + 0, true);
					const offset = bytesView.getUint32(bytes.byteOffset + 4, true);
					const crc = bytesView.getUint32(bytes.byteOffset + 8, true);
					debug$1(`selected ${type}: offset ${offset}, crc ${crc}, max size ${chunkSize}`);
					return [offset, crc, chunkSize];
				})
		);
	}

	abortObject() {
		debug$1("Abort (mark payload chunk as ready)");
		return this.ready().then(() =>
			this.writeCommand(
				new Uint8Array([
					0x0c, // "Abort" opcode
				])
			)
		);
	}
}

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


const debug = Debug("dfu:noble");

let _noble;
async function getNoble() {
	const noble = _noble ?? (await import('@abandonware/noble')).default; //require('@abandonware/noble')();
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

class DfuTransportNoble extends DfuTransportPrn {
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
		const service = services.find(it => it.uuid == "fe59");
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

export { DfuError, DfuOperation, DfuTransportNoble, DfuUpdates, ErrorCode };
