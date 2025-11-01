'use strict';
/**
 * POST /api/auth/register  — регистрация
 * POST /api/auth/login     — вход
 * GET  /api/auth/me        — текущий пользователь
 */

const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { requireAuth, signToken } = require('../middleware/auth');

// ── Валидаторы ────────────────────────────────────────────

const registerValidators = [
    body('username')
        .trim()
        .isLength({ min: 3, max: 50 })
        .withMessage('Имя пользователя: 3–50 символов')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Только латиница, цифры, _ и -'),
    body('email')
        .isEmail().normalizeEmail()
        .withMessage('Некорректный email'),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Пароль: минимум 8 символов')
];

const loginValidators = [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
];

function validate(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }
    next();
}

// ── POST /register ────────────────────────────────────────

router.post('/register', registerValidators, validate, async (req, res, next) => {
    const { username, email, password } = req.body;
    try {
        const exists = await req.db.query(
            'SELECT id FROM users WHERE email = $1 OR username = $2',
            [email, username]
        );
        if (exists.rows.length > 0) {
            return res.status(409).json({ error: 'Пользователь с таким email или именем уже существует' });
        }
        const hash = await bcrypt.hash(password, 12);
        const { rows } = await req.db.query(
            `INSERT INTO users (username, email, password_hash)
             VALUES ($1, $2, $3)
             RETURNING id, username, email, created_at`,
            [username, email, hash]
        );
        const user  = rows[0];
        const token = signToken({ sub: user.id, username: user.username });
        res.status(201).json({ user, token });
    } catch (err) {
        next(err);
    }
});

// ── POST /login ───────────────────────────────────────────

router.post('/login', loginValidators, validate, async (req, res, next) => {
    const { email, password } = req.body;
    try {
        const { rows } = await req.db.query(
            'SELECT id, username, email, password_hash FROM users WHERE email = $1',
            [email]
        );
        const user = rows[0];
        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }
        const token = signToken({ sub: user.id, username: user.username });
        res.json({
            user:  { id: user.id, username: user.username, email: user.email },
            token
        });
    } catch (err) {
        next(err);
    }
});

// ── GET /me ───────────────────────────────────────────────

router.get('/me', requireAuth, async (req, res, next) => {
    try {
        const { rows } = await req.db.query(
            'SELECT id, username, email, avatar_url, created_at FROM users WHERE id = $1',
            [req.user.sub]
        );
        if (!rows[0]) return res.status(404).json({ error: 'User not found' });
        res.json(rows[0]);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
