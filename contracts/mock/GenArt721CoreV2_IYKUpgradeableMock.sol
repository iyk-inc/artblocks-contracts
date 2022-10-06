// SPDX-License-Identifier: LGPL-3.0-only
// Created By: Art Blocks Inc.

import "../interfaces/0.8.x/IRandomizer.sol";
import "../interfaces/0.8.x/IGenArt721CoreV2_PBAB.sol";

import "@openzeppelin-4.5/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin-4.5/contracts/utils/Strings.sol";
import "@openzeppelin-4.5/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin-4.5/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin-4.5/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin-4.5/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "../PBAB+Collabs/GenArt721CoreV2_IYKUpgradeable.sol";

pragma solidity 0.8.9;

/**
 * @title Powered by Art Blocks ERC-721 core contract.
 * @author Art Blocks Inc.
 */
contract GenArt721CoreV2_IYKUpgradeableMock is GenArt721CoreV2_IYKUpgradeable {
    uint256 public mock;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {}

    /**
     * @notice Initializes contract.
     * @param _tokenName Name of token.
     * @param _tokenSymbol Token symbol.
     * @param _randomizerContract Randomizer contract.
     * @param _startingProjectId The initial next project ID.
     * @dev _startingProjectId should be set to a value much, much less than
     * max(uint256) to avoid overflow when adding to it.
     */
    function initialize__v1_1(
        string memory _tokenName,
        string memory _tokenSymbol,
        address _randomizerContract,
        uint256 _startingProjectId,
        uint256 _mock
    ) public initializer {
        GenArt721CoreV2_IYKUpgradeable.initialize(
            _tokenName,
            _tokenSymbol,
            _randomizerContract,
            _startingProjectId
        );
        upgradeTo__v1_1(_mock);
    }

    /**
     * @notice Initialization subwork for the specified version
     * @param _mock Some mock value
     * @dev Called independently via OpenZeppelin's upgrade function,
     * or called via the this version's initializer first calls the parent initializer
     */
    function upgradeTo__v1_1(uint256 _mock) public upgradeVersion(1) {
        mock = _mock;
    }

    // Overidden to guard against which users can access
    function _authorizeUpgrade(address newImplementation)
        internal
        virtual
        override
        onlyAdmin
    {}

    function setMock(uint256 _mock) public {
        mock = _mock;
    }

    function setSignVerifier(address _signVerifier)
        external
        virtual
        override
        onlyAdmin
    {
        mock = 1337;
        signVerifier = _signVerifier;
    }
}
