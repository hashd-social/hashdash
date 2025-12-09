// Contract addresses from environment variables
export const CONTRACT_ADDRESSES = {
  // Storage Contracts (Eternal)
  MESSAGE_STORAGE: process.env.REACT_APP_MESSAGE_STORAGE || '',
  KEY_STORAGE: process.env.REACT_APP_KEY_STORAGE || '',
  ACCOUNT_STORAGE: process.env.REACT_APP_ACCOUNT_STORAGE || '',
  POST_STORAGE: process.env.REACT_APP_POST_STORAGE || '',
  USER_PROFILE_STORAGE: process.env.REACT_APP_USER_PROFILE_STORAGE || '',
  GROUP_FACTORY_STORAGE: process.env.REACT_APP_GROUP_FACTORY_STORAGE || '',
  
  // Logic Contracts (Upgradeable)
  KEY_REGISTRY: process.env.REACT_APP_KEY_REGISTRY || '',
  ACCOUNT_REGISTRY: process.env.REACT_APP_ACCOUNT_REGISTRY || '',
  HASHD_TAG: process.env.REACT_APP_HASHD_TAG || '',
  MESSAGE_CONTRACT: process.env.REACT_APP_MESSAGE_CONTRACT || '',
  USER_PROFILE: process.env.REACT_APP_USER_PROFILE || '',
  GROUP_POSTS_DEPLOYER: process.env.REACT_APP_GROUP_POSTS_DEPLOYER || '',
  GROUP_COMMENTS_DEPLOYER: process.env.REACT_APP_GROUP_COMMENTS_DEPLOYER || '',
  BONDING_CURVE_DEPLOYER: process.env.REACT_APP_BONDING_CURVE_DEPLOYER || '',
  GROUP_FACTORY: process.env.REACT_APP_GROUP_FACTORY || '',
  DEPLOYMENT_REGISTRY: process.env.REACT_APP_DEPLOYMENT_REGISTRY || '',
};

// Network configuration
export const NETWORK_CONFIG = {
  CHAIN_ID: parseInt(process.env.REACT_APP_CHAIN_ID || '31337'),
  RPC_URL: process.env.REACT_APP_RPC_URL || 'http://127.0.0.1:8545',
};

// Contract ABIs for dashboard management
export const ACCOUNT_REGISTRY_ABI = [
  // Domain management (owner only)
  "function addDomain(string domain, uint256[5] tierPrices)",
  "function setDomainTierPrices(string domain, uint256[5] tierPrices)",
  "function batchSetDomainTierPrices(string[] domains, uint256[5][] tierPricesArray)",
  "function removeDomain(string domain)",
  "function withdrawFees()",
  
  // First HashdTag free toggle (owner only)
  "function setFirstHashdTagFreeEnabled(bool enabled)",
  "function firstHashdTagFreeEnabled() view returns (bool)",
  
  // View functions
  "function getAvailableDomains() view returns (string[])",
  "function getDomainTierPrices(string domain) view returns (uint256[5])",
  "function getDomainAccountCount(string domain) view returns (uint256)",
  "function owner() view returns (address)",
  
  // Events
  "event DomainAdded(string domain, uint256 fee)",
  "event DomainRemoved(string domain)",
  "event DomainFeeUpdated(string domain, uint256 oldFee, uint256 newFee)",
  "event FirstHashdTagFreeToggled(bool enabled)",
];

export const HASHD_TAG_ABI = [
  // Domain color management (owner only)
  "function setDomainColor(string domain, string color)",
  "function domainColors(string domain) view returns (string)",
  
  // Royalty management (owner only)
  "function setRoyalty(address recipient, uint96 feeNumerator)",
  "function royaltyInfo(uint256 tokenId, uint256 salePrice) view returns (address receiver, uint256 royaltyAmount)",
  
  // Fee withdrawal (owner only)
  "function withdrawFees()",
  
  // Owner free minting
  "function ownerMint(address to, string name, string domain)",
  "function isNameAvailable(string name, string domain) view returns (bool)",
  
  // View functions
  "function owner() view returns (address)",
  
  // Events
  "event DomainColorUpdated(string indexed domain, string color)",
  "event HashdTagMintedByOwner(address indexed to, uint256 indexed tokenId, string name, string domain)",
];

export const DEPLOYMENT_REGISTRY_ABI = [
  "function getAllDeployments() view returns (tuple(string name, address contractAddress, uint256 deployedAt, string version, bool isActive)[])",
  "function getDeployment(string name) view returns (address contractAddress, uint256 deployedAt, string version, bool isActive)",
  "function owner() view returns (address)",
];

// Contract info type
export interface ContractInfo {
  name: string;
  address: string;
  type: 'storage' | 'logic';
}

// Helper to get all contract info for display
export function getAllContractInfo(): ContractInfo[] {
  const contracts: ContractInfo[] = [
    // Storage contracts
    { name: 'MessageStorage', address: CONTRACT_ADDRESSES.MESSAGE_STORAGE, type: 'storage' as const },
    { name: 'KeyStorage', address: CONTRACT_ADDRESSES.KEY_STORAGE, type: 'storage' as const },
    { name: 'AccountStorage', address: CONTRACT_ADDRESSES.ACCOUNT_STORAGE, type: 'storage' as const },
    { name: 'PostStorage', address: CONTRACT_ADDRESSES.POST_STORAGE, type: 'storage' as const },
    { name: 'UserProfileStorage', address: CONTRACT_ADDRESSES.USER_PROFILE_STORAGE, type: 'storage' as const },
    { name: 'GroupFactoryStorage', address: CONTRACT_ADDRESSES.GROUP_FACTORY_STORAGE, type: 'storage' as const },
    // Logic contracts
    { name: 'KeyRegistry', address: CONTRACT_ADDRESSES.KEY_REGISTRY, type: 'logic' as const },
    { name: 'AccountRegistry', address: CONTRACT_ADDRESSES.ACCOUNT_REGISTRY, type: 'logic' as const },
    { name: 'HashdTag', address: CONTRACT_ADDRESSES.HASHD_TAG, type: 'logic' as const },
    { name: 'MessageContract', address: CONTRACT_ADDRESSES.MESSAGE_CONTRACT, type: 'logic' as const },
    { name: 'UserProfile', address: CONTRACT_ADDRESSES.USER_PROFILE, type: 'logic' as const },
    { name: 'GroupPostsDeployer', address: CONTRACT_ADDRESSES.GROUP_POSTS_DEPLOYER, type: 'logic' as const },
    { name: 'GroupCommentsDeployer', address: CONTRACT_ADDRESSES.GROUP_COMMENTS_DEPLOYER, type: 'logic' as const },
    { name: 'BondingCurveDeployer', address: CONTRACT_ADDRESSES.BONDING_CURVE_DEPLOYER, type: 'logic' as const },
    { name: 'GroupFactory', address: CONTRACT_ADDRESSES.GROUP_FACTORY, type: 'logic' as const },
    { name: 'DeploymentRegistry', address: CONTRACT_ADDRESSES.DEPLOYMENT_REGISTRY, type: 'logic' as const },
  ];
  return contracts.filter(c => c.address);
}
