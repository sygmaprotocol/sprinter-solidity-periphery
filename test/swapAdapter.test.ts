// The Licensed Work is (c) 2022 Sygma
// SPDX-License-Identifier: LGPL-3.0-only

import { expect }  from "chai";
import hre from "hardhat";
import { createResourceID, createERCDepositData, createOptionalContractCallDepositData }  from "./helpers";
import type {
  IERC20,
  SwapAdapter,
  MockNative,
  MockERC20,
  MockFeeHandler
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("SwapAdapter", function () {
  const resourceID_Native = "0x0000000000000000000000000000000000000000000000000000000000000650";
  const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const USDC_OWNER_ADDRESS = process.env.USDC_OWNER_ADDRESS!;
  if (!USDC_OWNER_ADDRESS) throw new Error("Env variables not configured (USDC_OWNER_ADDRESS missing)");
  const UNIVERSAL_ROUTER_ADDRESS = "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD";
  const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
  const originDomainID = 1;
  const destinationDomainID = 3;
  const fee = 1000;

  const resourceID_USDC = createResourceID(
    USDC_ADDRESS,
    originDomainID
  );
  
  let recipientAddress: SignerWithAddress;
  let depositorAddress: SignerWithAddress;
  let usdc: IERC20;
  let weth: IERC20;
  let swapAdapter: SwapAdapter;
  let usdcOwner: SignerWithAddress;
  let mockNative: MockNative;
  let mockERC20: MockERC20;
  let feeHandler: MockFeeHandler;

  async function deployNativeAdapterFixture() {
    [recipientAddress, depositorAddress] = await hre.ethers.getSigners();
    // deploy mock bridge
    const MockFeeHandler = await hre.ethers.getContractFactory("MockFeeHandler");
    feeHandler = await MockFeeHandler.deploy(fee);
    const MockNative = await hre.ethers.getContractFactory("MockNative");
    mockNative = await MockNative.deploy(resourceID_Native, feeHandler.target, destinationDomainID);

    // deploy swap adapter
    const SwapAdapter = await hre.ethers.getContractFactory("SwapAdapter");
    swapAdapter = await SwapAdapter.deploy(
      mockNative.target,
      WETH_ADDRESS,
      UNIVERSAL_ROUTER_ADDRESS,
      PERMIT2_ADDRESS,
      mockNative.target
    );

    usdc = await hre.ethers.getContractAt("IERC20", USDC_ADDRESS);
    weth = await hre.ethers.getContractAt("IERC20", WETH_ADDRESS);
    usdcOwner = await hre.ethers.getImpersonatedSigner(USDC_OWNER_ADDRESS);
  }

  async function deployERC20AdapterFixture() {
    [recipientAddress, depositorAddress] = await hre.ethers.getSigners();
    // deploy mock bridge
    const MockFeeHandler = await hre.ethers.getContractFactory("MockFeeHandler");
    feeHandler = await MockFeeHandler.deploy(fee);
    const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
    mockERC20 = await MockERC20.deploy(resourceID_Native, feeHandler.target, destinationDomainID, USDC_ADDRESS);

    // deploy swap adapter
    const SwapAdapter = await hre.ethers.getContractFactory("SwapAdapter");
    swapAdapter = await SwapAdapter.deploy(
      mockERC20.target,
      WETH_ADDRESS,
      UNIVERSAL_ROUTER_ADDRESS,
      PERMIT2_ADDRESS,
      mockERC20.target
    );

    usdc = await hre.ethers.getContractAt("IERC20", USDC_ADDRESS);
    weth = await hre.ethers.getContractAt("IERC20", WETH_ADDRESS);
    usdcOwner = await hre.ethers.getImpersonatedSigner(USDC_OWNER_ADDRESS);
  }

  describe("Deployment", function () {
    it("Should deploy the swap adapter with native adapter", async function () {
      await deployNativeAdapterFixture();
    });
  });

  describe("Swapping", function () {
    it("should swap tokens to ETH and bridge ETH", async () => {
      await deployNativeAdapterFixture();

      const pathTokens = [WETH_ADDRESS, USDC_ADDRESS];
      const pathFees = [500];
      const amountInMax = 1000000;
      const amountOut = hre.ethers.parseUnits("200000", "gwei");
      await usdc.connect(usdcOwner).approve(swapAdapter.target, amountInMax);
      const depositTx = await swapAdapter.connect(usdcOwner).depositTokensToEth(
        destinationDomainID,
        recipientAddress,
        USDC_ADDRESS,
        amountInMax,
        amountOut,
        pathTokens,
        pathFees
      );
      expect(await hre.ethers.provider.getBalance(swapAdapter.target)).to.eq(0);
      expect(await hre.ethers.provider.getBalance(feeHandler.target)).to.eq(fee);
      expect(await hre.ethers.provider.getBalance(mockNative.target)).to.eq(amountOut);

      const eventFilter = swapAdapter.filters.TokensSwapped();
      const events = await swapAdapter.queryFilter(eventFilter, "latest");
      const amountIn = events[0].args[2];
      expect(amountIn).to.be.lessThan(amountInMax);
      await expect(depositTx).to.changeTokenBalance(usdc, USDC_OWNER_ADDRESS, -amountIn);
      await expect(depositTx).to.emit(swapAdapter, "TokensSwapped")
        .withArgs(USDC_ADDRESS, WETH_ADDRESS, amountIn, amountOut + BigInt(fee));
      await expect(depositTx).to.emit(mockNative, "DepositToEVM")
        .withArgs(destinationDomainID, recipientAddress, amountOut);
    });

    it("should swap ETH to tokens and bridge tokens", async () => {
      await deployERC20AdapterFixture();

      const pathTokens = [USDC_ADDRESS, WETH_ADDRESS];
      const pathFees = [500];
      const amountInMax = hre.ethers.parseEther("1");
      const amountOut = 2000000000;
      await swapAdapter.setTokenResourceID(USDC_ADDRESS, resourceID_USDC);
      await usdc.connect(usdcOwner).approve(swapAdapter.target, amountInMax);
      const depositTx = await swapAdapter.connect(depositorAddress).depositEthToTokens(
        destinationDomainID,
        recipientAddress,
        USDC_ADDRESS,
        amountOut,
        pathTokens,
        pathFees,
        {
          value: amountInMax
        }
      );

      expect(await usdc.balanceOf(swapAdapter.target)).to.eq(0);
      expect(await hre.ethers.provider.getBalance(swapAdapter.target)).to.eq(0);
      expect(await hre.ethers.provider.getBalance(mockERC20.target)).to.eq(0);
      expect(await hre.ethers.provider.getBalance(UNIVERSAL_ROUTER_ADDRESS)).to.eq(0);

      expect(await hre.ethers.provider.getBalance(feeHandler.target)).to.eq(fee);
      expect(await weth.balanceOf(UNIVERSAL_ROUTER_ADDRESS)).to.eq(0);
      expect(await weth.balanceOf(swapAdapter.target)).to.eq(0);
      expect(await usdc.balanceOf(mockERC20.target)).to.eq(amountOut);

      const eventFilter = swapAdapter.filters.TokensSwapped();
      const events = await swapAdapter.queryFilter(eventFilter, "latest");
      const amountIn = events[0].args[2];
      expect(amountIn).to.be.lessThan(amountInMax);
      await expect(depositTx).to.changeEtherBalance(depositorAddress, -(amountIn + BigInt(fee)));
      await expect(depositTx).to.emit(swapAdapter, "TokensSwapped")
        .withArgs(WETH_ADDRESS, USDC_ADDRESS, amountIn, amountOut);
      
      const depositData = await createERCDepositData(amountOut, 20, recipientAddress.address);
      await expect(depositTx).to.emit(mockERC20, "Deposit")
        .withArgs(destinationDomainID, resourceID_USDC, depositData.toLowerCase(), "0x");
    });

    it("should swap tokens to ETH and bridge ETH with contract call", async () => {
      await deployNativeAdapterFixture();

      const pathTokens = [WETH_ADDRESS, USDC_ADDRESS];
      const pathFees = [500];
      const amountInMax = 1000000;
      const amountOut = hre.ethers.parseUnits("200000", "gwei");
      const message = "0x01234567890ABCDEF01234567890ABCDEF";
      const executionGasAmount = 30000000;
      await usdc.connect(usdcOwner).approve(swapAdapter.target, amountInMax);
      const depositTx = await swapAdapter.connect(usdcOwner).depositTokensToEthWithMessage(
        destinationDomainID,
        recipientAddress,
        executionGasAmount,
        message,
        USDC_ADDRESS,
        amountInMax,
        amountOut,
        pathTokens,
        pathFees
      );
      expect(await hre.ethers.provider.getBalance(swapAdapter.target)).to.eq(0);
      expect(await hre.ethers.provider.getBalance(feeHandler.target)).to.eq(fee);
      expect(await hre.ethers.provider.getBalance(mockNative.target)).to.eq(amountOut);

      const eventFilter = swapAdapter.filters.TokensSwapped();
      const events = await swapAdapter.queryFilter(eventFilter, "latest");
      const amountIn = events[0].args[2];
      expect(amountIn).to.be.lessThan(amountInMax);
      await expect(depositTx).to.changeTokenBalance(usdc, USDC_OWNER_ADDRESS, -amountIn);
      await expect(depositTx).to.emit(swapAdapter, "TokensSwapped")
        .withArgs(USDC_ADDRESS, WETH_ADDRESS, amountIn, amountOut + BigInt(fee));
      await expect(depositTx).to.emit(mockNative, "DepositToEVMWithMessage")
        .withArgs(destinationDomainID, recipientAddress, executionGasAmount, message.toLowerCase(), amountOut);
    });

    it("should swap ETH to tokens and bridge tokens with contract call", async () => {
      await deployERC20AdapterFixture();

      const pathTokens = [USDC_ADDRESS, WETH_ADDRESS];
      const pathFees = [500];
      const amountInMax = hre.ethers.parseEther("1");
      const amountOut = 2000000000;
      const message = "0x01234567890ABCDEF01234567890ABCDEF";
      const executionGasAmount = 30000000;
      await swapAdapter.setTokenResourceID(USDC_ADDRESS, resourceID_USDC);
      await usdc.connect(usdcOwner).approve(swapAdapter.target, amountInMax);
      const depositTx = await swapAdapter.connect(depositorAddress).depositEthToTokensWithMessage(
        destinationDomainID,
        recipientAddress,
        executionGasAmount,
        message,
        USDC_ADDRESS,
        amountOut,
        pathTokens,
        pathFees,
        {
          value: amountInMax,
          from: depositorAddress
        }
      );

      expect(await usdc.balanceOf(swapAdapter.target)).to.eq(0);
      expect(await hre.ethers.provider.getBalance(swapAdapter.target)).to.eq(0);
      expect(await hre.ethers.provider.getBalance(mockERC20.target)).to.eq(0);
      expect(await hre.ethers.provider.getBalance(UNIVERSAL_ROUTER_ADDRESS)).to.eq(0);

      expect(await hre.ethers.provider.getBalance(feeHandler.target)).to.eq(fee);
      expect(await weth.balanceOf(UNIVERSAL_ROUTER_ADDRESS)).to.eq(0);
      expect(await weth.balanceOf(swapAdapter.target)).to.eq(0);
      expect(await usdc.balanceOf(mockERC20.target)).to.eq(amountOut);

      const eventFilter = swapAdapter.filters.TokensSwapped();
      const events = await swapAdapter.queryFilter(eventFilter, "latest");
      const amountIn = events[0].args[2];
      expect(amountIn).to.be.lessThan(amountInMax);
      await expect(depositTx).to.changeEtherBalance(depositorAddress, -(amountIn + BigInt(fee)));
      await expect(depositTx).to.emit(swapAdapter, "TokensSwapped")
        .withArgs(WETH_ADDRESS, USDC_ADDRESS, amountIn, amountOut);
      
      const depositData = await createOptionalContractCallDepositData(
        amountOut,
        recipientAddress.address,
        executionGasAmount,
        message
      );
      await expect(depositTx).to.emit(mockERC20, "Deposit")
        .withArgs(destinationDomainID, resourceID_USDC, depositData.toLowerCase(), "0x");
    });

    it("should fail if no approve", async () => {
      await deployNativeAdapterFixture();

      const pathTokens = [WETH_ADDRESS, USDC_ADDRESS];
      const pathFees = [500];
      const amountInMax = 1000000;
      const amountOut = hre.ethers.parseUnits("200000", "gwei");
      await expect(swapAdapter.connect(usdcOwner).depositTokensToEth(
        destinationDomainID,
        recipientAddress,
        USDC_ADDRESS,
        amountInMax,
        amountOut,
        pathTokens,
        pathFees
      )).to.be.reverted;
    });

    it("should fail if the path is invalid [tokens length and fees length]", async () => {
      await deployNativeAdapterFixture();

      const pathTokens = [WETH_ADDRESS, USDC_ADDRESS];
      const pathFees = [500, 300];
      const amountInMax = 1000000;
      const amountOut = hre.ethers.parseUnits("200000", "gwei");
      await usdc.connect(usdcOwner).approve(swapAdapter.target, amountInMax);
      await expect(swapAdapter.connect(usdcOwner).depositTokensToEth(
        destinationDomainID,
        recipientAddress,
        USDC_ADDRESS,
        amountInMax,
        amountOut,
        pathTokens,
        pathFees
      )).to.be.revertedWithCustomError(swapAdapter, "PathInvalid()");
    });

    it("should fail if the path is invalid [tokenIn is not token0]", async () => {
      await deployNativeAdapterFixture();

      const pathTokens = [USDC_ADDRESS, WETH_ADDRESS];
      const pathFees = [500];
      const amountInMax = 1000000;
      const amountOut = hre.ethers.parseUnits("200000", "gwei");
      await usdc.connect(usdcOwner).approve(swapAdapter.target, amountInMax);
      await expect(swapAdapter.connect(usdcOwner).depositTokensToEth(
        destinationDomainID,
        recipientAddress,
        USDC_ADDRESS,
        amountInMax,
        amountOut,
        pathTokens,
        pathFees
      )).to.be.revertedWithCustomError(swapAdapter, "PathInvalid()");
    });

    it("should fail if the path is invalid  [tokenOut is not weth]", async () => {
      await deployNativeAdapterFixture();

      const pathTokens = [USDC_ADDRESS, USDC_ADDRESS];
      const pathFees = [500];
      const amountInMax = 1000000;
      const amountOut = hre.ethers.parseUnits("200000", "gwei");
      await usdc.connect(usdcOwner).approve(swapAdapter.target, amountInMax);
      await expect(swapAdapter.connect(usdcOwner).depositTokensToEth(
        destinationDomainID,
        recipientAddress,
        USDC_ADDRESS,
        amountInMax,
        amountOut,
        pathTokens,
        pathFees
      )).to.be.revertedWithCustomError(swapAdapter, "PathInvalid()");
    });

    it("should fail if the resource id is not configured", async () => {
      await deployERC20AdapterFixture();

      const pathTokens = [USDC_ADDRESS, WETH_ADDRESS];
      const pathFees = [500];
      const amountInMax = hre.ethers.parseEther("1");
      const amountOut = 2000000000;
      await usdc.connect(usdcOwner).approve(swapAdapter.target, amountInMax);
      await expect(swapAdapter.connect(usdcOwner).depositEthToTokens(
        destinationDomainID,
        recipientAddress,
        USDC_ADDRESS,
        amountOut,
        pathTokens,
        pathFees,
        {
          value: amountInMax
        }
      )).to.be.revertedWithCustomError(swapAdapter, "TokenInvalid()");
    });

    it("should fail if no msg.value supplied", async () => {
      await deployERC20AdapterFixture();

      const pathTokens = [USDC_ADDRESS, WETH_ADDRESS];
      const pathFees = [500];
      const amountInMax = hre.ethers.parseEther("1");
      const amountOut = 2000000000;
      await swapAdapter.setTokenResourceID(USDC_ADDRESS, resourceID_USDC);
      await usdc.connect(usdcOwner).approve(swapAdapter.target, amountInMax);
      await expect(swapAdapter.connect(usdcOwner).depositEthToTokens(
        destinationDomainID,
        recipientAddress,
        USDC_ADDRESS,
        amountOut,
        pathTokens,
        pathFees
      )).to.be.revertedWithCustomError(swapAdapter, "InsufficientAmount(uint256)");
    });

    it("should fail if msg.value is less than fee", async () => {
      await deployERC20AdapterFixture();

      const pathTokens = [USDC_ADDRESS, WETH_ADDRESS];
      const pathFees = [500];
      const amountInMax = hre.ethers.parseEther("1");
      const amountOut = 2000000000;
      await swapAdapter.setTokenResourceID(USDC_ADDRESS, resourceID_USDC);
      await usdc.connect(usdcOwner).approve(swapAdapter.target, amountInMax);
      await expect(swapAdapter.connect(usdcOwner).depositEthToTokens(
        destinationDomainID,
        recipientAddress,
        USDC_ADDRESS,
        amountOut,
        pathTokens,
        pathFees,
        {
          value: 5
        }
      )).to.be.revertedWithCustomError(swapAdapter, "MsgValueLowerThanFee(uint256)");
    });
  });
});
