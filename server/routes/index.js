const router = require('express').Router();

// Placeholder — add your route modules here
// e.g. router.use('/documents', require('./documents'));

router.get('/ping', (req, res) => {
  res.json({ message: 'DocDime API is running' });
});

module.exports = router;
