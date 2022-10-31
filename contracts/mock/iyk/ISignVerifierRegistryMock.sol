// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

interface ISignVerifierRegistryMock {
  function register(bytes32 id, address signVerifier) external;

  function update(bytes32 id, address signVerifier) external;

  function get(bytes32 id) external view returns (address);
}
