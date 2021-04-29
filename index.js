const Instagram = require('instagram-web-api');
const { default: axios } = require('axios');
const fs = require('fs');

const username = '';
const password = '';

const usersByCommet = 2;

const media_key = '';

const blacklist = [];
const whitelist = [];

class InstagramComments {
  client = new Instagram({ username, password });
  impossible_to_comment = 0;
  current = 1;
  total = 0;

  constructor() {
    this.main();

    const data = new Date();

    this.log_filename = `${data.getFullYear()}-${
      data.getMonth() + 1
    }-${data.getUTCDate()}-${data.getHours()}-${data.getMinutes()}-${data.getSeconds()}-log.txt`;

    fs.appendFileSync(`log/${this.log_filename}`, 'num,id,comment,tempo,hora\n');
  }

  async main() {
    try {
      // Authenticate
      console.log('⏲ Autenticando usuário...');
      const login = await this.client.login();

      if (!login.authenticated) {
        console.log('❌ Não foi possível realizar a autenticação, verifique seus dados e tente novamente!');
        return;
      }

      console.log('✔️ Usuário autenticado com sucesso');

      // Get the instagram user id
      const userId = await this.getUserId(username);

      // Get the followings
      console.log();

      let possibleFollowers = whitelist;

      if (!whitelist.length) {
        console.log('⏲ Buscando quem você segue...');
        const followersData = (await this.client.getFollowings({ userId, first: 743 })).data;
        possibleFollowers = followersData
          .filter((user) => {
            if (!user.is_verified && !blacklist.includes(user.username)) return user;
          })
          .map((user) => user.username);
        console.log(`✔️  Achamos ${possibleFollowers.length} possíveis perfis que você segue`);
      } else {
        console.log(`ℹ️ Utilizaremos os ${whitelist.length} perfis da sua whitelist`);
      }

      possibleFollowers = possibleFollowers.map((user) => `@${user.trim()}`);

      this.toBeCommented = [];

      if (usersByCommet === 1) {
        this.toBeCommented = possibleFollowers;
      } else {
        for (let i = 0; i < possibleFollowers.length; i = i + usersByCommet) {
          let commentLine = '';

          for (let j = i; j < i + usersByCommet; j++) {
            if (j !== i + usersByCommet) commentLine += ' ';

            commentLine += possibleFollowers[j] || '';
          }

          this.toBeCommented.push(commentLine.trim());
        }
      }

      this.total = this.toBeCommented.length;

      // Get the post id
      console.log();
      console.log('⏲ Buscando id da publicação...');
      const post_id = await this.getMediaId(media_key);
      console.log(`✔️ Id da publicação localizada -> ${post_id}`);

      // Comentando na publicação
      console.log();
      console.log('⏲ Comentando na publicação...');
      await this.toBeCommented.reduce((p, c) => p.then(() => this.makeComment(post_id, c)), Promise.resolve());
      console.log(`✔️ Foi comentado ${this.toBeCommented.length} vezes na publicação`);

      console.log();
      console.log('🎉 Boa sorte com o sorteio, até mais');
    } catch (err) {
      console.log();
      console.log('❌ Erro -', err.message);
    }
  }

  async getUserId(username) {
    const { data } = await axios.get(`https://www.instagram.com/${username}/?__a=1`);

    return data.graphql.user.id;
  }

  async getMediaId(media) {
    const { data } = await axios.get(`http://api.instagram.com/oembed?callback=&url=https://www.instagram.com/p/${media}/`);

    return data.media_id;
  }

  randomMilisseconds(minSeconds = 30, maxSeconds = 60) {
    return (minSeconds + Math.floor((maxSeconds - minSeconds) * Math.random())) * 1000;
  }

  makeComment(mediaId, comment) {
    return new Promise((resolve, reject) => {
      const qtdeMilisseconds = this.randomMilisseconds();
      const qtdeSeconds = qtdeMilisseconds / 1000;

      console.log(`   ${this.current}/${this.total} - Comentando o usuario ${comment} em ${qtdeSeconds} segundos`);
      setTimeout(async () => {
        try {
          const commentData = await this.client.addComment({
            mediaId,
            text: comment,
          });

          fs.appendFileSync(`log/${this.log_filename}`, `${this.current},${commentData.id},${comment},${qtdeSeconds},${new Date()}\n`);

          this.current++;
          resolve();
        } catch (err) {
          const { statusCode } = err.response;

          fs.appendFileSync(
            `log/${this.log_filename}`,
            `\n 
            ERROR ${this.current},${comment},${qtdeSeconds},${statusCode},${new Date()}\n
            ${err.message}\n\n`
          );
          // console.log(`   Status -> ${statusCode}`);

          if (statusCode === 429) {
            console.log(`   ⚠️ Ocorreu um erro ao comentar ${comment} adicionaremos ele no final da lista`);

            this.toBeCommented.push(comment);
          } else {
            console.log(`   ❌ Não é possível comentar ${comment}`);
            this.impossible_to_comment++;
          }

          resolve();
        }
      }, qtdeMilisseconds);
    });
  }
}

new InstagramComments();
