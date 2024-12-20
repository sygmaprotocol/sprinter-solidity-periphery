// The Licensed Work is (c) 2022 Sygma
// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.27;

/**
    @title Interface for Bridge contract.
    @author ChainSafe Systems.
 */
interface INativeTokenAdapter {
     function _resourceID() external view returns(bytes32);

     function depositToEVM(
        uint8 destinationDomainID,
        address recipientAddress
    ) external payable;

    function depositToEVMWithMessage(
        uint8 destinationDomainID,
        address recipient, 
        uint256 gas, 
        bytes calldata message
    ) external payable;
}
