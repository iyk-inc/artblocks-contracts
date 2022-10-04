import { Coder } from "@ethersproject/abi/lib/coders/abstract-coder";
import {
  BN,
  constants,
  expectEvent,
  expectRevert,
  balance,
  ether,
} from "@openzeppelin/test-helpers";
import { expect } from "chai";
import { BigNumber, Wallet } from "ethers";
import { arrayify } from "ethers/lib/utils";
import { ethers } from "hardhat";

import {
  getAccounts,
  assignDefaultConstants,
  deployAndGet,
  deployCoreWithMinterFilter,
} from "../util/common";

/**
 * These tests are intended to check basic updates to the V2 PBAB core contract.
 * Note that this test suite is not complete, and does not test all functionality.
 * It includes tests for any added functionality after initial V2 PBAB release.
 */
describe("GenArt721CoreV2_IYK_Integration", async function () {
  beforeEach(async function () {
    // standard accounts and constants
    this.accounts = await getAccounts();
    await assignDefaultConstants.call(this);
    // deploy and configure core, randomizer, and minter
    this.randomizer = await deployAndGet.call(this, "BasicRandomizer", []);
    // V2_PRTNR need additional arg for starting project ID
    this.genArt721Core = await deployAndGet.call(this, "GenArt721CoreV2_IYK", [
      this.name,
      this.symbol,
      this.randomizer.address,
      0,
    ]);
    this.minter = await deployAndGet.call(this, "GenArt721Minter_PBAB", [
      this.genArt721Core.address,
    ]);

    // add minter
    await this.genArt721Core
      .connect(this.accounts.deployer)
      .addMintWhitelisted(this.minter.address);

    // add project
    await this.genArt721Core
      .connect(this.accounts.deployer)
      .addProject("name", this.accounts.artist.address, this.projectZero);

    // Assign iyk verifier
    await this.genArt721Core
      .connect(this.accounts.deployer)
      .setSignVerifier("0xF13B8a3f9a44dA0d910C2532CD95c96CA9b5E92a");
  });

  describe("initial nextProjectId", function () {
    it("returns zero when initialized to zero nextProjectId", async function () {
      // one project has already been added, so should be one
      expect(await this.genArt721Core.nextProjectId()).to.be.equal(1);
    });

    it("returns >0 when initialized to >0 nextProjectId", async function () {
      const differentGenArt721Core = await deployAndGet.call(
        this,
        "GenArt721CoreV2_PRTNR",
        [this.name, this.symbol, this.randomizer.address, 365]
      );
      expect(await differentGenArt721Core.nextProjectId()).to.be.equal(365);
    });
  });

  describe("IYK integration", () => {
    it("symbol and name should be initialized", async function () {
      const symbol = await this.genArt721Core.symbol();
      const name = await this.genArt721Core.name();
      expect(symbol).to.equal(this.symbol);
      expect(name).to.equal(this.name);
    });

    // claiming tests
    it("getClaimSigningHash should return the correct hash", async function () {
      const blockExpiry = ethers.BigNumber.from(123);
      const tokenId = ethers.BigNumber.from(1);

      const claimSigningHash = await this.genArt721Core.getClaimSigningHash(
        blockExpiry,
        this.accounts.user.address,
        tokenId
      );
      expect(claimSigningHash).to.equal(
        ethers.utils.solidityKeccak256(
          ["uint256", "address", "uint256", "address", "uint256"],
          [
            blockExpiry,
            this.accounts.user.address,
            tokenId,
            this.genArt721Core.address,
            await this.genArt721Core.getClaimNonce(this.accounts.user.address),
          ]
        )
      );
    });

    it("claimNFT should move a token with a valid signature", async function () {
      await this.genArt721Core
        .connect(this.accounts.deployer)
        .toggleProjectIsActive(this.projectZero);
      await this.genArt721Core
        .connect(this.accounts.artist)
        .updateProjectMaxInvocations(this.projectZero, this.maxInvocations);
      await this.genArt721Core
        .connect(this.accounts.artist)
        .toggleProjectIsPaused(this.projectZero);
      // add user minter for testing IYK integration
      await this.genArt721Core
        .connect(this.accounts.deployer)
        .addMintWhitelisted(this.accounts.additional.address);

      // Mint token to owner
      const tokenId = (
        await this.genArt721Core
          .connect(this.accounts.additional)
          .mint(
            this.accounts.deployer.address,
            this.projectZero,
            this.accounts.deployer.address
          )
      ).value;

      // Get signing hash
      const currentBlockNumber = await ethers.provider.getBlockNumber();
      const blockExpiry = ethers.BigNumber.from(currentBlockNumber + 20);
      const claimSigningHash = await this.genArt721Core.getClaimSigningHash(
        blockExpiry,
        this.accounts.user.address,
        tokenId
      );

      // SignVerifier signs hash
      const wallet = new Wallet(
        "fb45bc2049e143fb168fd438ae6dd3eefffa7f798a7f4d865b6748831abaa625" as string
      );
      const sig = await wallet.signMessage(arrayify(claimSigningHash));

      // Send claim from addr1
      await this.genArt721Core
        .connect(this.accounts.user)
        .claimNFT(sig, blockExpiry, this.accounts.user.address, tokenId);

      expect(await this.genArt721Core.ownerOf(tokenId)).to.not.equal(
        this.accounts.deployer.address
      );
      expect(await this.genArt721Core.ownerOf(tokenId)).to.equal(
        this.accounts.user.address
      );
    });

    it("claimNFT should revert on expired signature", async function () {
      await this.genArt721Core
        .connect(this.accounts.deployer)
        .toggleProjectIsActive(this.projectZero);
      await this.genArt721Core
        .connect(this.accounts.artist)
        .updateProjectMaxInvocations(this.projectZero, this.maxInvocations);
      await this.genArt721Core
        .connect(this.accounts.artist)
        .toggleProjectIsPaused(this.projectZero);
      // add user minter for testing IYK integration
      await this.genArt721Core
        .connect(this.accounts.deployer)
        .addMintWhitelisted(this.accounts.additional.address);

      // Mint token to owner
      const tokenId = (
        await this.genArt721Core
          .connect(this.accounts.additional)
          .mint(
            this.accounts.deployer.address,
            this.projectZero,
            this.accounts.deployer.address
          )
      ).value;

      // Get signing hash
      const currentBlockNumber = await ethers.provider.getBlockNumber();
      const blockExpiry = ethers.BigNumber.from(currentBlockNumber + 1);
      const claimSigningHash = await this.genArt721Core.getClaimSigningHash(
        blockExpiry,
        this.accounts.user.address,
        tokenId
      );

      // SignVerifier signs hash
      const wallet = new Wallet(
        "fb45bc2049e143fb168fd438ae6dd3eefffa7f798a7f4d865b6748831abaa625" as string
      );
      const sig = await wallet.signMessage(arrayify(claimSigningHash));

      // Send claim from addr1 on CURR_BLOCK_NUMBER + 1 (expiry block)
      await ethers.provider.send("evm_mine", []);

      // Expect claim to fail
      expect(
        this.genArt721Core
          .connect(this.accounts.user)
          .claimNFT(sig, blockExpiry, this.accounts.user.address, tokenId)
      ).to.be.revertedWith("Sig expired");
    });

    it("claimNFT should revert when using the same signature again", async function () {
      await this.genArt721Core
        .connect(this.accounts.deployer)
        .toggleProjectIsActive(this.projectZero);
      await this.genArt721Core
        .connect(this.accounts.artist)
        .updateProjectMaxInvocations(this.projectZero, this.maxInvocations);
      await this.genArt721Core
        .connect(this.accounts.artist)
        .toggleProjectIsPaused(this.projectZero);
      // add user minter for testing IYK integration
      await this.genArt721Core
        .connect(this.accounts.deployer)
        .addMintWhitelisted(this.accounts.additional.address);

      // Mint token to owner
      const tokenId = (
        await this.genArt721Core
          .connect(this.accounts.additional)
          .mint(
            this.accounts.deployer.address,
            this.projectZero,
            this.accounts.deployer.address
          )
      ).value;

      // Get signing hash
      const currentBlockNumber = await ethers.provider.getBlockNumber();
      const blockExpiry = ethers.BigNumber.from(currentBlockNumber + 20);
      const claimSigningHash = await this.genArt721Core.getClaimSigningHash(
        blockExpiry,
        this.accounts.user.address,
        tokenId
      );

      // SignVerifier signs hash
      const wallet = new Wallet(
        "fb45bc2049e143fb168fd438ae6dd3eefffa7f798a7f4d865b6748831abaa625" as string
      );
      const sig = await wallet.signMessage(arrayify(claimSigningHash));

      // Send claim from addr1
      await this.genArt721Core
        .connect(this.accounts.user)
        .claimNFT(sig, blockExpiry, this.accounts.user.address, tokenId);

      expect(await this.genArt721Core.ownerOf(tokenId)).to.not.equal(
        this.accounts.deployer.address
      );
      expect(await this.genArt721Core.ownerOf(tokenId)).to.equal(
        this.accounts.user.address
      );

      // Expect claim to fail with same sig
      expect(
        this.genArt721Core
          .connect(this.accounts.user2)
          .claimNFT(sig, blockExpiry, this.accounts.user.address, tokenId)
      ).to.be.revertedWith("Permission to call this function failed");
    });

    it("claimNFT should revert on nonexistent tokenId", async function () {
      await this.genArt721Core
        .connect(this.accounts.deployer)
        .toggleProjectIsActive(this.projectZero);
      await this.genArt721Core
        .connect(this.accounts.artist)
        .updateProjectMaxInvocations(this.projectZero, this.maxInvocations);
      await this.genArt721Core
        .connect(this.accounts.artist)
        .toggleProjectIsPaused(this.projectZero);
      // add user minter for testing IYK integration
      await this.genArt721Core
        .connect(this.accounts.deployer)
        .addMintWhitelisted(this.accounts.additional.address);

      // Mint token to owner
      await this.genArt721Core
        .connect(this.accounts.additional)
        .mint(
          this.accounts.deployer.address,
          this.projectZero,
          this.accounts.deployer.address
        );
      const tokenId = ethers.BigNumber.from(5);

      // Get signing hash
      const currentBlockNumber = await ethers.provider.getBlockNumber();
      const blockExpiry = ethers.BigNumber.from(currentBlockNumber + 20);
      const claimSigningHash = await this.genArt721Core.getClaimSigningHash(
        blockExpiry,
        this.accounts.user.address,
        tokenId
      );

      // SignVerifier signs hash
      const wallet = new Wallet(
        "fb45bc2049e143fb168fd438ae6dd3eefffa7f798a7f4d865b6748831abaa625" as string
      );
      const sig = await wallet.signMessage(arrayify(claimSigningHash));

      // Expect claim to fail
      expect(
        this.genArt721Core
          .connect(this.accounts.user)
          .claimNFT(sig, blockExpiry, this.accounts.user.address, tokenId)
      ).to.be.revertedWith("ERC721: owner query for nonexistent token");
    });
  });
});
