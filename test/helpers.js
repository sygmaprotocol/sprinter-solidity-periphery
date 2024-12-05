// The Licensed Work is (c) 2022 Sygma
// SPDX-License-Identifier: LGPL-3.0-only

const toHex = (covertThis, padding) => {
  return ethers.zeroPadValue(ethers.toBeHex(covertThis), padding);
};

const createERCDepositData = (
  tokenAmountOrID,
  lenRecipientAddress,
  recipientAddress
) => {
  return (
    "0x" +
    toHex(tokenAmountOrID, 32).substr(2) + // Token amount or ID to deposit (32 bytes)
    toHex(lenRecipientAddress, 32).substr(2) + // len(recipientAddress)          (32 bytes)
    recipientAddress.substr(2)
  ); // recipientAddress               (?? bytes)
};

const createResourceID = (contractAddress, domainID) => {
  return toHex(contractAddress + toHex(domainID, 1).substr(2), 32);
};

const createOptionalContractCallDepositData = function(amount, recipient, executionGasAmount, message) {
  return (
    "0x" +
    toHex(amount, 32).substr(2) + // uint256
    toHex(recipient.substr(2).length / 2, 32).substr(2) + // uint256
    recipient.substr(2) + // bytes
    toHex(executionGasAmount, 32).substr(2) + // uint256
    toHex(message.substr(2).length / 2, 32).substr(2) + // uint256
    message.substr(2) // bytes
  )
}

module.exports = {
  createERCDepositData,
  createResourceID,
  createOptionalContractCallDepositData,
};
