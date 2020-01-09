const fs = require('fs');
const axios = require('axios');
const qs = require('querystring');
const bodyparser = require('body-parser');
const express = require('express');
const app = express();

app.use(bodyparser.json());

const port = 3800 | process.env.PORT;

let config = {
    twitch: {
        client_id: "",
        client_secret: "",
        scopes: [],
        redirect_uri: ""
    },
    spotify: {
        client_id: "",
        client_secret: "",
        scopes: [],
        redirect_uri: "",
    }
};

if(fs.existsSync('config.json')){
    config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
} else {
    fs.writeFileSync('config.json', JSON.stringify(config));
}

let spotifyHeader = new Buffer(config.spotify.client_id + ":" + config.spotify.client_secret).toString("base64");

// SPOTIFY
app.get('/spotify/login', (req, res) => {
    let scopes = "";
    config.spotify.scopes.forEach((s) => scopes += s + " ");
    res.redirect(`https://accounts.spotify.com/authorize?response_type=code&client_id=${config.spotify.client_id}&scope=${scopes}&redirect_uri=${encodeURIComponent(config.spotify.redirect_uri)}`);
});

app.get('/spotify/redirect', async (req, res) => {
    let resp = await spotifyAuth(req.query.code);
    if(!resp.error){
        res.send(`
    <html>
        <body>
            <h1>Authorized</h1>
            <script type="text/javascript">
                fetch('http://localhost:3001/spotify/token', {method: 'POST', body: "${JSON.stringify(resp)}", headers: {'Content-Type': 'application/json'}});
            </script>
        </body>
    </html>
    `);
    } else {
        res.send(`
    <html>
        <body>
            <h1>Unable to authorize</h1>
        </body>
    </html>
    `);
    }
});


app.post('/spotify/refresh', async (req, res) => {
    let resp = await refreshToken(req.body.refresh_token);
    return res.json(resp);
});

async function spotifyAuth(code) {
    return await doSpotifyRequest({code, grant_type: "authorization_code", redirect_uri: config.spotify.redirect_uri});
}
async function refreshToken(refreshToken) {
    return await doSpotifyRequest({refresh_token: refreshToken, grant_type: "refresh_token"});
}
async function doSpotifyRequest(data){
    let response = await axios({method: 'POST', url: 'https://accounts.spotify.com/api/token', headers: {
        Authorization: `Basic ${spotifyHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded'
    }, data: qs.stringify(data)}).then((resp) =>  resp.data).catch((err) => {
        console.error(err);
        return null;
    });
    if(response !== null && response.access_token){
        return response;
    } else {
        return {
            error: "Unable to authenticate"
        }
    }
}

// TWITCH
app.get('/twitch/login', (req, res) => {
    let scopes = "";
    config.twitch.scopes.forEach((s, i) => scopes += s + (i === config.twitch.scopes.length - 1 ? '' : " "));
    res.redirect(`https://id.twitch.tv/oauth2/authorize?client_id=${config.twitch.client_id}&redirect_uri=${encodeURIComponent(config.twitch.redirect_uri)}&response_type=code&scope=${encodeURI(scopes)}`);
});

app.get('/twitch/redirect', async (req, res) => {
    let resp = await twitchAuth(req.query.code);
    if(!resp.error){
        res.send(`
    <html>
        <body>
            <h1>Authorized</h1>
            <script type="text/javascript">
                fetch('http://localhost:3001/twitch/token', {method: 'POST', body: "${JSON.stringify(resp)}", headers: {'Content-Type': 'application/json'}});
            </script>
        </body>
    </html>
    `);
    } else {
        res.send(`
    <html>
        <body>
            <h1>Unable to authorize</h1>
        </body>
    </html>
    `);
    }
});


app.post('/twitch/refresh', async (req, res) => {
    let resp = await refreshTwitchToken(req.body.refresh_token);
    return res.json(resp);
});

async function twitchAuth(code) {
    return await doTwitchRequest({code, grant_type: "authorization_code", redirect_uri: config.twitch.redirect_uri});
}
async function refreshTwitchToken(refreshToken) {
    return await doTwitchRequest({refresh_token: refreshToken, grant_type: "refresh_token"});
}
async function doTwitchRequest(data){
    let response = await axios({method: 'POST', url: `https://id.twitch.tv/oauth2/token`, params: {client_id: config.twitch.client_id, client_secret: config.twitch.client_secret, ...data}}).then((resp) =>  resp.data).catch((err) => {
        console.error(err);
        return null;
    });
    if(response !== null && response.access_token){
        return response;
    } else {
        return {
            error: "Unable to authenticate"
        }
    }
}

app.get('/twitch/channel/:name', async (req, res) => {
    let response = await axios.get(`https://api.twitch.tv/helix/users?login=${req.params.name}`, {headers: {
        'Client-ID': config.twitch.client_id
    }}).then((resp) => resp.data).catch((err) => {
        return {error: err};
    });
    return response;
});

app.get('/twitch/follows/:channelID', async (req, res) => {
    let response = await axios.get(`https://api.twitch.tv/helix/users/follows?to_id=${req.params.channelID}`, {headers: {
        'Client-ID': config.twitch.client_id
    }}).then((resp) => resp.data).catch((err) => {
        return {error: err};
    });
    return response;
});

app.get('/twitch/user/:token', async (req, res) => {
    let response = await axios.get(`https://api.twitch.tv/helix/users`, {headers: {
        'Client-ID': config.twitch.client_id,
        'Authorization': `Bearer: ${req.params.token}`
    }}).then((resp) => resp.data).catch((err) => {
        return {error: err};
    });
    return response;
});

app.listen(port, () => console.log(`DynamicOverlay Service is now running on port ${port}`));
