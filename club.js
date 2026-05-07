export default async function handler(req, res) {
  try {
    const tag = req.query.tag;

    if (!tag) {
      return res.status(400).json({ error: 'Missing tag' });
    }

    const cleanTag = tag.replace('#', '');

    const response = await fetch(
      `https://api.brawlstars.com/v1/players/%23${cleanTag}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.BRAWL_TOKEN}`
        }
      }
    );

    const data = await response.json();

    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
