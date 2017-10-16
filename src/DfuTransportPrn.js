
import DfuAbstractTransport from './DfuAbstractTransport';

// FIXME: Should be `import {crc32} from 'crc'`, https://github.com/alexgorbatchev/node-crc/pull/50
// import * as crc from 'crc';
// const crc32 = crc.crc32;
// import {crc32} from 'crc';
import crc32 from 'crc/src/crc32';


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

export default class DfuTransportPrn extends DfuAbstractTransport {
    // The constructor takes the value for the PRN interval. It should be
    // provided by the concrete subclasses.
    constructor(packetReceiveNotification = 16) {
        super();

        if (this.constructor === DfuTransportPrn) {
            throw new Error("Cannot instantiate DfuTransportPrn, use a concrete subclass instead.");
        }

        if (packetReceiveNotification > 0xFFFF) { // Ensure it fits in 16 bits
            throw new Error('DFU procotol cannot use a PRN higher than 0xFFFF.');
        }

        this._prn = packetReceiveNotification;


        // Store *one* message waitig to be _read()
        this._lastReceivedPacket;

        // Store *one* reference to a _read() callback function
        this._waitingForPacket;

        // Maximum Transmission Unit. Its value **must** be filled in by the
        // concrete subclasses before any data is sent.
        this._mtu = undefined;
    }

    // Abstract method. Concrete subclasses shall implement sending the bytes
    // into the wire/air.
    // The bytes shall include an opcode and payload.
    _writeCommand(bytes) {}

    // Abstract method. Concrete subclasses shall implement sending the bytes
    // into the wire/air.
    // The bytes are all data bytes. Subclasses are responsible for packing
    // this into a command (serial DFU) or sending them through the wire/air
    // through an alternate channel (BLE DFU)
    _writeData(bytes) {}


    // Requests a (decoded and) parsed packet/message, either a response
    // to a previous command or a PRN notification.
    // Returns a Promise to [opcode, Uint8Array].
    // Cannot have more than one pending request at any time.
    _read() {
        if (this._waitingForPacket) {
            throw new Error('DFU transport tried to _read() while another _read() was still waiting');
        }

        if (this._lastReceivedPacket) {
            let packet = this._lastReceivedPacket;
            delete this._lastReceivedPacket;
            return Promise.resolve(packet);
        }

        /// Store the callback so it can be called as soon as the wire packet is
        /// ready. Add a 5sec timeout while we're at it.
        return Promise.race([
            new Promise((res)=>{
                this._waitingForPacket = res;
            }),
            new Promise((res, rej)=>{
                setTimeout(()=>rej('Timeout while reading from serial port. Is the nRF in bootloader mode?'), 5000);
            })
        ]);
    }

    // Must be called when a (complete) packet/message is received, with the
    // (decoded) bytes of the entire packet/message. Either stores the packet
    // just received, or calls the pending _read() callback to unlock it
    _onData(bytes) {
        if (this._lastReceivedPacket) {
            throw new Error('DFU transport received two messages at once');
        }

        if (this._waitingForPacket) {
            let callback = this._waitingForPacket;
            delete this._waitingForPacket;
            return callback(this._parse(bytes));
        }

        this._lastReceivedPacket = this._parse(bytes);
    }

    // Abstract method, called before any operation that would send bytes.
    // Concrete subclasses **must**:
    // - Check validity of the connection,
    // - Re-initialize connection if needed, including
    //   - Set up PRN
    //   - Request MTU (only if the transport has a variable MTU)
    // - Return a Promise whenever the connection is ready.
    _ready() {}


    // Parses a received DFU response packet/message, does a couple of checks,
    // then returns an array of the form [opcode, payload] if the
    // operation was sucessful.
    _parse(bytes) {
// console.log('Received SLIP packet: ', bytes);
        if (bytes[0] !== 0x60) {
            return Promise.reject('Response from DFU target did not start with 0x60');
        }
        const opcode = bytes[1];
        const resultCode = bytes[2];
        if (resultCode === 0x01) {
console.log('Parsed SLIP packet: ', [opcode, bytes.subarray(3)]);
            return Promise.resolve([opcode, bytes.subarray(3)]);
        } else if (resultCode === 0x00) {
            return Promise.reject('Received error from DFU target: Missing or malformed opcode');
        } else if (resultCode === 0x02) {
            return this._read();
            return Promise.reject('Received error from DFU target: Invalid opcode');
        } else if (resultCode === 0x03) {
            return Promise.reject('Received error from DFU target: A parameter for the opcode was missing, or unsupported opcode');
        } else if (resultCode === 0x04) {
            return Promise.reject('Received error from DFU target: Not enough memory for the data object');
        } else if (resultCode === 0x05) {
            return Promise.reject('Received error from DFU target: The data object didn\'t match firmware/hardware, or missing crypto signature, or command parse failed');
        } else if (resultCode === 0x07) {
            return Promise.reject('Received error from DFU target: Unsupported object type for create/read operation');
        } else if (resultCode === 0x08) {
            return Promise.reject('Received error from DFU target: Cannot allow this operation in the current DFU state');
        } else if (resultCode === 0x0A) {
            return Promise.reject('Received error from DFU target: Operation failed');
        } else if (resultCode === 0x0A) {
            return Promise.reject('Received error from DFU target: Extended error');
        } else {
            return Promise.reject('Received unknown result code from DFU target: ' + resultCode);
        }
    }


    // Returns a *function* that checks a [opcode, bytes] parameter against the given
    // opcode and byte length, and returns only the bytes.
    _assertPacket(expectedOpcode, expectedLength) {
        return ([opcode, bytes])=>{
            if (opcode !== expectedOpcode) {
                return Promise.reject(`Expected a response with opcode ${expectedOpcode}, got ${opcode} instead.`);
            }

            if (bytes.length !== expectedLength) {
                return Promise.reject(`Expected ${expectedLength} in response to opcode ${expectedOpcode}, got ${bytes.length}.`);
            }

            return bytes;
        };
    }


    _createObject(type, size) {
console.log(`CreateObject type ${type}, size ${size}`);

        return this._ready().then(()=>{
            return this._writeCommand(new Uint8Array([
                0x01,   // "Create object" opcode
                type,
                size >> 0  & 0xFF,
                size >> 8  & 0xFF,
                size >> 16 & 0xFF,
                size >> 24 & 0xFF
            ]))
            .then(this._read.bind(this))
            .then(this._assertPacket(0x01, 0));

//             console.log('Should send select message');
        });
    }

    _writeObject(bytes, crcSoFar, offsetSoFar) {
console.log('WriteObject');
        return this._ready().then(()=>{
            return this._writeObjectPiece(bytes, crcSoFar, offsetSoFar, 0);
        })
    }

    // Sends *one* write operation (with up to this._mtu bytes of un-encoded data)
    // Triggers a counter-based PRN confirmation
    _writeObjectPiece(bytes, crcSoFar, offsetSoFar, prnCount) {
        return this._ready().then(()=>{

            const sendLength = Math.min(this._mtu - 1, bytes.length);
//             const sendLength = 1; // DEBUG

            const bytesToSend = bytes.subarray(0, sendLength);
//             const packet = new Uint8Array(sendLength + 1);
//             packet.set([0x08], 0);    // "Write" opcode
//             packet.set(bytesToSend, 1);

            offsetSoFar += sendLength;
            crcSoFar = crc32(bytesToSend, crcSoFar);
            prnCount += 1;

            return this._writeData(bytesToSend)
            .then(()=>{
                if (prnCount >= this._prn) {
console.log('PRN hit, expecting CRC');
                    // Expect a CRC due to PRN
                    prnCount = 0;
                    return this._readCrc().then(([offset, crc])=>{
                        if (offsetSoFar === offset && crcSoFar === crc) {
                            console.log(`PRN checksum OK at offset ${offset} (0x${offset.toString(16)}) (0x${crc.toString(16)})`);
                            return;
                        } else {
                            return Promise.reject(`CRC mismatch during PRN at byte ${offset}/${offsetSoFar}, expected 0x${crcSoFar.toString(16)} but got 0x${crc.toString(16)} instead`);
//                             console.warn(`CRC mismatch during PRN at byte ${offset}/${offsetSoFar}, expected 0x${crcSoFar.toString(16)} but got 0x${crc.toString(16)} instead`);
                        }
                    });
                } else {
                    // Expect no explicit response
                    return;
                }
            })
//             .then(()=>new Promise(res=>{setTimeout(res, 100);}))    // Synthetic timeout for debugging
            .then(()=>{
                if (sendLength < bytes.length) {
                    // Send more stuff
                    return this._writeObjectPiece(bytes.subarray(sendLength), crcSoFar, offsetSoFar, prnCount);
                } else {
                    return [offsetSoFar, crcSoFar];
                }
            })
        });
    }

    // Reads a PRN CRC response and returns the offset/CRC pair
    _readCrc() {
        return this._ready().then(()=>{
            return this._read()
            .then(this._assertPacket(0x03, 8))
            .then((bytes)=>{
                // Decode little-endian fields
                const bytesView = new DataView( bytes.buffer );
                const offset    = bytesView.getUint32(bytes.byteOffset + 0, true);
                const crc       = bytesView.getUint32(bytes.byteOffset + 4, true);
// console.log(`read checksum: `, bytes, [offset, crc])

//                 // DEBUG: Once in every 11 CRC responses, apply a XOR to the CRC
//                 // to make it look like something has failed.
//
//                 if ((this._crcFailCounter = (this._crcFailCounter || 0) + 1) >= 11) {
//                 if (Math.random() < 0.15) {
//                     console.log('DEBUG: mangling CRC response to make it look like a failure');
//                     this._crcFailCounter = 0;
//                     return [offset, Math.abs(crc - 0x1111)];
//                 }

                return [offset, crc];
            });
        });
    }

    _crcObject() {
console.log('Request CRC');

        return this._ready().then(()=>{
            return this._writeCommand(new Uint8Array([
                0x03   // "CRC" opcode
            ]))
            .then(this._readCrc.bind(this));
        });
    }

    _executeObject() {
console.log('Execute (mark payload chunk as ready)')
        return this._ready().then(()=>{
            return new Promise(res=>{setTimeout(res, 5000);})    // Synthetic timeout for debugging
//             return this._writeCommand(new Uint8Array([
            .then(()=>this._writeCommand(new Uint8Array([
                0x04   // "Execute" opcode
            ])))
            .then(()=>new Promise(res=>{setTimeout(res, 5000);}))    // Synthetic timeout for debugging
            .then(this._read.bind(this))
            .then(this._assertPacket(0x04, 0));
        });
    }

    _selectObject(type) {
console.log('Select (report max size and current offset/crc)');

        return this._ready().then(()=>{
            return this._writeCommand(new Uint8Array([
                0x06,   // "Select object" opcode
                type
            ]))
            .then(this._read.bind(this))
            .then(this._assertPacket(0x06, 12))
            .then((bytes)=>{

                // Decode little-endian fields
                const bytesView = new DataView( bytes.buffer );
                const chunkSize = bytesView.getUint32(bytes.byteOffset + 0, true);
                const offset    = bytesView.getUint32(bytes.byteOffset + 4, true);
                const crc       = bytesView.getUint32(bytes.byteOffset + 8, true);
console.log(`select ${type}: offset ${offset}, crc ${crc}, max size ${chunkSize}`);
                return [offset, crc, chunkSize];
            });

//             console.log('Should send select message');
        });
    }
}



