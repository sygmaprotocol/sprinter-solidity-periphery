// The Licensed Work is (c) 2022 Sygma
// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.27;

import "../interfaces/IBridge.sol";
import "../interfaces/INativeTokenAdapter.sol";
import "../interfaces/IFeeHandler.sol";
// import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/*
    This is a test contract that serves as a mock entry point to the Sygma Bridge contract
    instead of NativeTokenAdapter. It combines NativeTokenAdapter, Sygma Bridge and fee handler contracts.
*/

contract MockNative is INativeTokenAdapter {
    IFeeHandler public immutable _feeHandler;
    bytes32 public immutable _resourceID;
    uint256 public immutable _domainID;
    address feeCollector;

    event DepositToEVM(uint8 destinationDomainID, address recipientAddress, uint256 amount);
    event DepositToEVMWithMessage(
        uint8 destinationDomainID,
        address recipient, 
        uint256 gas, 
        bytes message,
        uint256 amount
    );

    constructor(bytes32 resourceID, IFeeHandler feeHandler, uint256 domainID) {
        _resourceID = resourceID;
        _feeHandler = feeHandler;
        _domainID = domainID;
    }

    function depositToEVM(
        uint8 destinationDomainID,
        address recipientAddress
    ) external payable {
        (uint256 fee, ) = _feeHandler.calculateFee(msg.sender, 0, 0, "0x", "", "");
        _feeHandler.collectFee{value: fee}(msg.sender, 0, 0, "0x", "", "");
        emit DepositToEVM(destinationDomainID, recipientAddress, msg.value - fee);
    }

    function depositToEVMWithMessage(
        uint8 destinationDomainID,
        address recipient, 
        uint256 gas, 
        bytes calldata message
    ) external payable {
        (uint256 fee, ) = _feeHandler.calculateFee(msg.sender, 0, 0, "0x", "", "");
        _feeHandler.collectFee{value: fee}(msg.sender, 0, 0, "0x", "", "");
        emit DepositToEVMWithMessage(destinationDomainID, recipient, gas, message, msg.value - fee);
    }
}

contract MockERC20 {
    IFeeHandler public immutable _feeHandler;
    bytes32 public immutable _resourceID;
    uint256 public immutable _domainID;
    IERC20 public immutable _token;
    address feeCollector;

    event Deposit(
        uint8 destinationDomainID,
        bytes32 resourceID,
        bytes depositData,
        bytes feeData
    );

    constructor(bytes32 resourceID, IFeeHandler feeHandler, uint256 domainID, IERC20 token) {
        _resourceID = resourceID;
        _feeHandler = feeHandler;
        _domainID = domainID;
        _token = token;
    }

    function deposit(
        uint8 destinationDomainID,
        bytes32 resourceID,
        bytes calldata depositData,
        bytes calldata feeData
    ) external payable returns (uint64 depositNonce, bytes memory handlerResponse) {
        uint256 amount;
        (amount) = abi.decode(depositData, (uint256));
        _token.transferFrom(msg.sender, address(this), amount);
        (uint256 fee, ) = _feeHandler.calculateFee(msg.sender, 0, 0, "0x", "", "");
        _feeHandler.collectFee{value: fee}(msg.sender, 0, 0, "0x", "", "");
        emit Deposit(destinationDomainID, resourceID, depositData, feeData);
        return (0, "");
    }

    function _resourceIDToHandlerAddress(bytes32) external view returns(address tokenAddress) {
        return address(this);
    }
}

contract MockFeeHandler is IFeeHandler {
    uint256 public immutable _fee;

    constructor(uint256 fee) {
        _fee = fee;
    }

    function calculateFee(
        address sender,
        uint8 fromDomainID,
        uint8 destinationDomainID,
        bytes32 resourceID,
        bytes calldata depositData,
        bytes calldata feeData
    ) external view returns(uint256, address) {
        return (_fee, address(0));
    }

    function collectFee(
        address sender,
        uint8 fromDomainID,
        uint8 destinationDomainID,
        bytes32 resourceID,
        bytes calldata depositData,
        bytes calldata feeData
    ) external payable {}
}
