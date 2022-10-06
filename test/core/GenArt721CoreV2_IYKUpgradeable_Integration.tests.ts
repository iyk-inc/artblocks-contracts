import { expect } from "chai";
import { BigNumber, Wallet } from "ethers";
import { arrayify } from "ethers/lib/utils";
import { ethers } from "hardhat";
import {
  assignDefaultConstants,
  deployAndGet,
  deployProxyAndGet,
  getAccounts,
  upgradeProxy,
} from "../util/common";

/**
 * These tests are intended to check the IYK integration & upgrade functionality.
 * These tests are not complete, and assume all GenArt721CoreV2_PBAB functionality
 * remains perfectly function.
 *
 * TODO: Test GenArt721CoreV2_PBAB functionality/
 * As GenArt721CoreV2_IYKUpgradeable does not subclass it, we must be retested.
 */
describe("GenArt721CoreV2_IYKUpgradeable_Integration", async function () {
  beforeEach(async function () {
    // standard accounts and constants
    this.accounts = await getAccounts();
    await assignDefaultConstants.call(this);
    this.signVerifier = new Wallet(
      "fb45bc2049e143fb168fd438ae6dd3eefffa7f798a7f4d865b6748831abaa625" as string
    );
    // deploy and configure core, randomizer, and minter
    this.randomizer = await deployAndGet.call(this, "BasicRandomizer", []);
    // V2_PRTNR need additional arg for starting project ID
    this.genArt721Core = await deployProxyAndGet.call(
      this,
      "GenArt721CoreV2_IYKUpgradeable",
      [this.name, this.symbol, this.randomizer.address, 0]
    );
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
      .setSignVerifier(this.signVerifier.address);
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

  describe("getClaimSigningHash", () => {
    describe("should return the correct hash", () => {
      it("when called", async function () {
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
              await this.genArt721Core.getClaimNonce(
                this.accounts.user.address
              ),
            ]
          )
        );
      });
    });
  });

  describe("claimNFT", () => {
    describe("should transfer a tokens ownership", () => {
      it("when the signature is valid", async function () {
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
        const sig = await this.signVerifier.signMessage(
          arrayify(claimSigningHash)
        );

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
    });
    describe("should revert", () => {
      it("when the signature has expired", async function () {
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
        const sig = await this.signVerifier.signMessage(
          arrayify(claimSigningHash)
        );

        // Send claim from addr1 on CURR_BLOCK_NUMBER + 1 (expiry block)
        await ethers.provider.send("evm_mine", []);

        // Expect claim to fail
        expect(
          this.genArt721Core
            .connect(this.accounts.user)
            .claimNFT(sig, blockExpiry, this.accounts.user.address, tokenId)
        ).to.be.revertedWith("Sig expired");
      });
      it("when reusing a signature", async function () {
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
        const sig = await this.signVerifier.signMessage(
          arrayify(claimSigningHash)
        );

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
      it("when tokenId has not yet been minted", async function () {
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
        const sig = await this.signVerifier.signMessage(
          arrayify(claimSigningHash)
        );

        // Expect claim to fail
        expect(
          this.genArt721Core
            .connect(this.accounts.user)
            .claimNFT(sig, blockExpiry, this.accounts.user.address, tokenId)
        ).to.be.revertedWith("ERC721: owner query for nonexistent token");
      });
    });
  });

  describe("UUPS Proxy", () => {
    describe("should be upgradeable", () => {
      it("when upgraded to a valid version", async function () {
        const upgradedProxy = await upgradeProxy.call(
          this,
          this.genArt721Core.address,
          "GenArt721CoreV2_IYKUpgradeableMock",
          {
            fn: "upgradeTo__v1_1",
            args: [BigNumber.from(5)],
          }
        );
        const minorVersion = await this.genArt721Core.minorVersion();

        expect(upgradedProxy.address).to.equal(this.genArt721Core.address);
        expect(minorVersion).to.equal(1);
      });
    });

    describe("should properly store values", () => {
      it("where old data is maintained after upgrade", async function () {
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

        const upgradedProxy = await upgradeProxy.call(
          this,
          this.genArt721Core.address,
          "GenArt721CoreV2_IYKUpgradeableMock",
          {
            fn: "upgradeTo__v1_1",
            args: [BigNumber.from(0)],
          }
        );

        const owner = await upgradedProxy.ownerOf(tokenId);

        expect(upgradedProxy.address).to.equal(this.genArt721Core.address);
        expect(owner).to.equal(this.accounts.deployer.address);
      });

      it("where new data can be accessed from the original reference", async function () {
        const upgradedProxy = await upgradeProxy.call(
          this,
          this.genArt721Core.address,
          "GenArt721CoreV2_IYKUpgradeableMock",
          {
            fn: "upgradeTo__v1_1",
            args: [BigNumber.from(0)],
          }
        );

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

        const owner = await upgradedProxy.ownerOf(tokenId);

        expect(upgradedProxy.address).to.equal(this.genArt721Core.address);
        expect(owner).to.equal(this.accounts.deployer.address);
      });
    });

    describe("should be able to extend functionality", () => {
      it("when a new variable is added", async function () {
        const upgradedProxy = await upgradeProxy.call(
          this,
          this.genArt721Core.address,
          "GenArt721CoreV2_IYKUpgradeableMock",
          {
            fn: "upgradeTo__v1_1",
            args: [BigNumber.from(5)],
          }
        );
        const mockValue = await upgradedProxy.mock();
        expect(mockValue).to.equal(BigNumber.from(5));
      });

      it("when a new function is added", async function () {
        const upgradedProxy = await upgradeProxy.call(
          this,
          this.genArt721Core.address,
          "GenArt721CoreV2_IYKUpgradeableMock",
          {
            fn: "upgradeTo__v1_1",
            args: [BigNumber.from(5)],
          }
        );
        const mockValueAfterUpgrade = await upgradedProxy.mock();
        await upgradedProxy.setMock(BigNumber.from(10));
        const mockValueAfterSet = await upgradedProxy.mock();

        expect(BigNumber.from(5)).to.equal(mockValueAfterUpgrade);
        expect(BigNumber.from(10)).to.equal(mockValueAfterSet);
      });
      it("when a virtual function is overriden", async function () {
        const upgradedProxy = await upgradeProxy.call(
          this,
          this.genArt721Core.address,
          "GenArt721CoreV2_IYKUpgradeableMock",
          {
            fn: "upgradeTo__v1_1",
            args: [BigNumber.from(5)],
          }
        );

        const mockValueAfterUpgrade = await upgradedProxy.mock();
        // Override setSignVerifier to set mock to 1337
        await upgradedProxy.setSignVerifier(this.signVerifier.address);
        const mockValueAfterSetSignVerifier = await upgradedProxy.mock();

        expect(BigNumber.from(5)).to.equal(mockValueAfterUpgrade);
        expect(BigNumber.from(1337)).to.equal(mockValueAfterSetSignVerifier);
      });
    });

    describe("should be safe against attackers", () => {
      it("who try to re-initialize a contract before it's been upgraded", async function () {
        expect(
          this.genArt721Core.initialize(
            this.name,
            this.symbol,
            this.randomizer.address,
            0
          )
        ).to.revertedWith("Initializable: contract is already initialized");
      });

      it("who try to re-initialize a contract after it's been upgraded", async function () {
        const upgradedProxy = await upgradeProxy.call(
          this,
          this.genArt721Core.address,
          "GenArt721CoreV2_IYKUpgradeableMock",
          {
            fn: "upgradeTo__v1_1",
            args: [BigNumber.from(5)],
          }
        );
        expect(
          upgradedProxy.initialize(
            this.name,
            this.symbol,
            this.randomizer.address,
            0
          )
        ).to.revertedWith("Initializable: contract is already initialized");
      });
    });
  });
});
