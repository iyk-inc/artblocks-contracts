// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

interface ISignVerifierRegistry {
    function getSignVerifier(bytes32 id) external view returns (address);
}
