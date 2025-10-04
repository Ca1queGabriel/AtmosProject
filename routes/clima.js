// routes/clima.js
const express = require('express');
const router = express.Router();
const axios = require('axios');

router.get('/', async (req, res) => {
    try {
        const response = await axios.get('https://api.meteomatics.com/2025-10-04T17:55:00.000-03:00/t_2m:C/-23.5003451,-47.4582864/json?model=mix', {
            auth: {
                username: 'lima_caique',
                password: 'py01s7YnAEAc14VEM952'
            }
        });
        res.json(response.data);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

module.exports = router;
