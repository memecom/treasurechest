var app = new Vue({
  el: "#app",
  data: {
    greeting: "",
    provider: "",
    vault: {
      abi: "",
      address: "0x84243561d488cd758764b0848469cb9a9798fcbf",
      contract: "",
      tokens: [],
    },
    keys: {
      abi: "",
      address: "",
      contract: "",
    },
    user: {
      account: "",
      balance: 0,
    },
    unlockstates: {
      show: false,
      approve: false,
      increaseAllowance: false,
      receivetoken: false,
    },
    contracts: {},
    contractImages: [],
  },
  methods: {
    humanizeWallet: function (account) {
      return `${account.substr(0, 5)}...${account.substr(-3)}`;
    },
    imageFromURI: async function (uri) {
      let url = uri;
      if (url.includes("ipfs://"))
        url = uri.replace("ipfs://", "https://ipfs.io/ipfs/");
      if (url.includes("http://")) url = uri.replace("http://", "https://");
      const response = await fetch(url);
      const data = await response.json();
      let imgurl = data.image;
      if (imgurl.includes("ipfs://"))
        imgurl = imgurl.replace("ipfs://", "https://ipfs.io/ipfs/");
      return imgurl;
    },
    fetchUserKeys: async function () {
      this.user.balance = await this.keys.contract.balanceOf(this.user.account);

      this.user.balance = ethers.utils.formatEther(this.user.balance) / 1;
    },
    resetUnlockStates: function () {
      this.unlockstates = {
        show: false,
        approve: false,
        increaseAllowance: false,
        receivetoken: false,
      };
    },
    userInit: async function () {
      // user init
      this.provider = new ethers.providers.Web3Provider(window.ethereum);
      await this.provider.send("eth_requestAccounts", []);
      const signer = this.provider.getSigner();
      this.user.account = await signer.getAddress();
    },
    vaultInit: async function () {
      // vault init
      this.vault.abi = [
        "function receiveToken(uint amount)",
        "function getNFTs() view returns (tuple(address contractAddress, uint256 tokenId, uint256 value)[] memory)",
        "function getTokenAddr() view returns (address token)",
      ];
      this.vault.contract = new ethers.Contract(
        this.vault.address,
        this.vault.abi,
        this.provider
      );
    },
    keysInit: async function () {
      //keys init
      this.keys.abi = [
        // Recieve key balance in wallet
        "function balanceOf(address) view returns (uint)",
        // Approve to spend your tokens
        "function approve(address spender, uint amount)",
        // Increase allowance after approving
        "function increaseAllowance(address spender, uint addedValue)",
      ];

      this.keys.address = await this.vault.contract.getTokenAddr();

      this.keys.contract = new ethers.Contract(
        this.keys.address,
        this.keys.abi,
        this.provider
      );
    },
    tokensInit: async function () {
      let tokens = await this.vault.contract.getNFTs();
      this.vault.tokens = [];

      tokens.map((token) => {
        let { tokenId, value, contractAddress } = token;
        tokenId = ethers.BigNumber.from(tokenId).toString();
        value = ethers.BigNumber.from(value).toString();
        this.vault.tokens.push({
          id: tokenId,
          value,
          address: contractAddress,
          uri: "",
        });
      });

      const ERC721ABI = [
        "function tokenURI(uint256 _tokenId) view returns (string)",
      ];

      this.vault.tokens.map(async (token, index) => {
        if (!this.contracts[token.address]) {
          let contract = new ethers.Contract(
            token.address,
            ERC721ABI,
            this.provider
          );
          this.contracts[token.address] = {};
          this.contracts[token.address] = contract;
        }
        let uri = await this.contracts[token.address].tokenURI(token.id);

        token.uri = await this.imageFromURI(uri);
        return token;
      });
    },
    init: async function () {
      if (window.ethereum) {
        try {
          await this.userInit();
          await this.vaultInit();
          await this.keysInit();
          await this.tokensInit();
          this.fetchUserKeys();
        } catch (e) {}
      } else {
        // this.greeting = "No web3? You should consider trying MetaMask!";
      }
    },
    unlocknft: async function () {
      const signer = this.provider.getSigner();

      this.unlockstates.show = true;

      try {
        const tx1 = await this.keys.contract
          .connect(signer)
          .approve(this.vault.address, "10000000000000000000");
        await tx1.wait();
        this.unlockstates.approve = true;
      } catch (e) {
        console.log(e);
        this.resetUnlockStates();
      }

      try {
        const tx2 = await this.keys.contract
          .connect(signer)
          .increaseAllowance(this.vault.address, "10000000000000000000");

        await tx2.wait();
        this.unlockstates.increaseAllowance = true;
      } catch (e) {
        console.log(e);
        this.resetUnlockStates();
      }

      try {
        const tx3 = await this.vault.contract
          .connect(signer)
          .receiveToken("10000000000000000000");

        await tx3.wait();
        this.unlockstates.receiveToken = true;
      } catch (e) {
        console.log(e);
        this.resetUnlockStates();
      }

      //sucess
      // re-initalize all tokens
      await this.tokensInit();
      // fetch current user balance
      this.fetchUserKeys();
      // reset unlock states
      this.resetUnlockStates();
    },
  },
  mounted: function () {
    this.init();
  },
});
