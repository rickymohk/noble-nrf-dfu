declare module 'noble-nrf-dfu' {
  import { Peripheral } from '@abandonware/noble';

  export class DfuOperation {
    constructor(dfuUpdates: DfuUpdates, dfuTransport: DfuTransport, autoStart?: boolean);
    start(forceful?: boolean): Promise<void>;
    private performNextUpdate(updateNumber: number, forceful: boolean): Promise<void>;
  }

  export class DfuUpdates {
    constructor(updates: Array<{
      initPacket: Uint8Array;
      firmwareImage: Uint8Array;
    }>);

    updates: Array<{
      initPacket: Uint8Array;
      firmwareImage: Uint8Array;
    }>;

    static fromZipFile(zipBytes: ArrayBuffer): Promise<DfuUpdates>;
    static fromZipFilePath(path: string): Promise<DfuUpdates>;
  }

  export interface DfuTransport {
    sendInitPacket(packet: Uint8Array): Promise<void>;
    sendFirmwareImage(image: Uint8Array): Promise<void>;
    restart(): Promise<void>;
    on(event:"progress",listener:(progress:{sent:number,total:number}) => void) : this;
  }

  export abstract class DfuAbstractTransport implements DfuTransport {
    protected abstract createObject(type: number, size: number): Promise<void>;
    protected abstract writeObject(bytes: Uint8Array, crc?: number, offset?: number): Promise<[number, number]>;
    protected abstract crcObject(offset: number, crc: number): Promise<[number, number]>;
    sendInitPacket(packet: Uint8Array): Promise<void>;
    sendFirmwareImage(image: Uint8Array): Promise<void>;
    restart(): Promise<void>;
    on(event:"progress",listener:(progress:{sent:number,total:number}) => void) : this;
  }

  export class DfuTransportNoble extends DfuAbstractTransport {
    protected override createObject(type: number, size: number): Promise<void>;
    protected override writeObject(bytes: Uint8Array, crc?: number, offset?: number): Promise<[number, number]>;
    protected override crcObject(offset: number, crc: number): Promise<[number, number]>;
    constructor(peripheral: Peripheral, packetReceiveNotification?: number);
    
    peripheral: Peripheral;
    dfuControlCharacteristic: any; // Replace 'any' with the actual type if available
    dfuPacketCharacteristic: any; // Replace 'any' with the actual type if available
    mtu: number;

    writeCommand(bytes: Uint8Array): Promise<void>;
    writeData(bytes: Uint8Array): Promise<void>;
    getCharacteristics(): Promise<void>;
    ready(): Promise<void>;
    
  }

  export class DfuError extends Error {
    constructor(code: ErrorCode, message: string);
    code: ErrorCode;
  }

  export enum ErrorCode {
    ERROR_MESSAGE = 0x00,
    ERROR_MESSAGE_RSP = 0x01,
    ERROR_MESSAGE_EXT = 0x02,
    ERROR_CAN_NOT_INIT_ABSTRACT_TRANSPORT = 0x0000,
    ERROR_PRE_DFU_INTERRUPTED = 0x0001,
    ERROR_UNEXPECTED_BYTES = 0x0002,
    ERROR_CRC_MISMATCH = 0x0003,
    ERROR_TOO_MANY_WRITE_FAILURES = 0x0004,
    ERROR_CAN_NOT_INIT_PRN_TRANSPORT = 0x0010,
    ERROR_CAN_NOT_USE_HIGHER_PRN = 0x0011,
    ERROR_READ_CONFLICT = 0x0012,
    ERROR_TIMEOUT_READING_SERIAL = 0x0013,
    ERROR_RECEIVE_TWO_MESSAGES = 0x0014,
    ERROR_RESPONSE_NOT_START_WITH_0x60 = 0x0015,
    ERROR_ASSERT_EMPTY_RESPONSE = 0x0016,
    ERROR_UNEXPECTED_RESPONSE_OPCODE = 0x0017,
    ERROR_UNEXPECTED_RESPONSE_BYTES = 0x0018,
    ERROR_MUST_HAVE_PAYLOAD = 0x0031,
    ERROR_INVOKED_MISMATCHED_CRC32 = 0x0032,
    ERROR_MORE_BYTES_THAN_CHUNK_SIZE = 0x0033,
    ERROR_INVALID_PAYLOAD_TYPE = 0x0034,
    ERROR_CAN_NOT_DISCOVER_DFU_CONTROL = 0x0051,
    ERROR_TIMEOUT_FETCHING_CHARACTERISTICS = 0x0052,
    ERROR_CAN_NOT_SUBSCRIBE_CHANGES = 0x0053,
    ERROR_UNKNOWN_FIRMWARE_TYPE = 0x0071,
    ERROR_UNABLE_FIND_PORT = 0x0072,
    ERROR_RSP_INVALID = 0x0100,
    ERROR_RSP_SUCCESS = 0x0101,
    ERROR_RSP_OP_CODE_NOT_SUPPORTED = 0x0102,
    ERROR_RSP_INVALID_PARAMETER = 0x0103,
    ERROR_RSP_INSUFFICIENT_RESOURCES = 0x0104,
    ERROR_RSP_INVALID_OBJECT = 0x0105,
    ERROR_RSP_UNSUPPORTED_TYPE = 0x0107,
    ERROR_RSP_OPERATION_NOT_PERMITTED = 0x0108,
    ERROR_RSP_OPERATION_FAILED = 0x010A,
    ERROR_RSP_EXT_ERROR = 0x010B,
    ERROR_EXT_NO_ERROR = 0x0200,
    ERROR_EXT_INVALID_ERROR_CODE = 0x0201,
    ERROR_EXT_WRONG_COMMAND_FORMAT = 0x0202,
    ERROR_EXT_UNKNOWN_COMMAND = 0x0203,
    ERROR_EXT_INIT_COMMAND_INVALID = 0x0204,
    ERROR_EXT_FW_VERSION_FAILURE = 0x0205,
    ERROR_EXT_HW_VERSION_FAILURE = 0x0206,
    ERROR_EXT_SD_VERSION_FAILURE = 0x0207,
    ERROR_EXT_SIGNATURE_MISSING = 0x0208,
    ERROR_EXT_WRONG_HASH_TYPE = 0x0209,
    ERROR_EXT_HASH_FAILED = 0x020A,
    ERROR_EXT_WRONG_SIGNATURE_TYPE = 0x020B,
    ERROR_EXT_VERIFICATION_FAILED = 0x020C,
    ERROR_EXT_INSUFFICIENT_SPACE = 0x020D,
    ERROR_EXT_FW_ALREADY_PRESENT = 0x020E,
  }
}
