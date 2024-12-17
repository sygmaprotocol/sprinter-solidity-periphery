// The Licensed Work is (c) 2022 Sygma
// SPDX-License-Identifier: LGPL-3.0-only

import { ethers } from "ethers";

const toHex = (covertThis: string | number, padding: number) : string => {
  return ethers.zeroPadValue(ethers.toBeHex(covertThis), padding);
};

export function createERCDepositData(
  tokenAmountOrID: number | string,
  lenRecipientAddress: number,
  recipientAccount: string,
): string {
  return (
    "0x" +
    toHex(tokenAmountOrID, 32).substring(2) + // Token amount or ID to deposit  (32 bytes)
    toHex(lenRecipientAddress, 32).substring(2) + // len(recipientAccount)  (32 bytes)
    recipientAccount.substring(2) // recipientAccount  (?? bytes)
  );
}

export function createResourceID(
  contractAddress: string,
  domainID: number,
): string {
  return toHex(contractAddress + toHex(domainID, 1).substring(2), 32);
}

export function  createOptionalContractCallDepositData(
  amount: number,
  recipient: string,
  executionGasAmount: number,
  message: string): string {
  return (
    "0x" +
    toHex(amount, 32).substring(2) + // uint256
    toHex(recipient.substring(2).length / 2, 32).substring(2) + // uint256
    recipient.substring(2) + // bytes
    toHex(executionGasAmount, 32).substring(2) + // uint256
    toHex(message.substring(2).length / 2, 32).substring(2) + // uint256
    message.substring(2) // bytes
  )
}

module.exports = {
  createERCDepositData,
  createResourceID,
  createOptionalContractCallDepositData,
};
