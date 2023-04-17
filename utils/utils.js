const { lineAccessToken } = require("../constant");
const axios = require("axios")

const sendLineNotify = async (message) => {
    try {
        await axios({
            method: 'POST',
            url: 'https://notify-api.line.me/api/notify',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Bearer ${lineAccessToken}`,
            },
            data: `message=${encodeURIComponent(message)}`,
        });
    } catch (error) {
        console.error(`Line Notify Error: ${error.message}`);
    }
}

module.exports = {
    sendLineNotify
}