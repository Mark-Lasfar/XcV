const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(cors({ origin: ['https://hager-zon.vercel.app', 'https://mark-elasfar.web.app'] }));
app.use(express.json());

// MongoDB connections
const connections = {
  hager: null,
  mgzon: null,
};

const connectToDatabase = async (dbName) => {
  const uri = dbName === 'hager'
    ? functions.config().mongodb.hager_uri
    : functions.config().mongodb.mgzon_uri;

  if (!connections[dbName] || connections[dbName].connection.readyState === 0) {
    try {
      connections[dbName] = await mongoose.createConnection(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
    } catch (error) {
      console.error(`MongoDB ${dbName} connection error:`, error);
      throw new Error(`Failed to connect to ${dbName} database`);
    }
  }
  return connections[dbName];
};

// News Article Schema
const newsArticleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  excerpt: { type: String, required: true },
  content: { type: String, required: true },
  tags: { type: [String], default: [] },
  metaTitle: { type: String, required: true },
  metaDescription: { type: String, required: true },
  image: { type: String, default: 'https://mark-elasfar.web.app/assets/img/default-article.jpg' },
  isPublished: { type: Boolean, required: true, default: false },
  isFeatured: { type: Boolean, default: false },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Author', required: true },
  likes: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
}, { timestamps: true });

// Author Schema
const authorSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  bio: { type: String, required: true },
  profileImageUrl: { type: String, default: 'https://mark-elasfar.web.app/assets/img/default-avatar.png' },
  socialLinks: { type: Object, default: {} },
}, { timestamps: true });

// Models for hager database
const HagerNewsArticle = connections.hager
  ? connections.hager.model('NewsArticle', newsArticleSchema)
  : mongoose.model('NewsArticle', newsArticleSchema);
const HagerAuthor = connections.hager
  ? connections.hager.model('Author', authorSchema)
  : mongoose.model('Author', authorSchema);

// Models for mgzon database
const MgzonNewsArticle = connections.mgzon
  ? connections.mgzon.model('NewsArticle', newsArticleSchema)
  : mongoose.model('NewsArticle', newsArticleSchema);
const MgzonAuthor = connections.mgzon
  ? connections.mgzon.model('Author', authorSchema)
  : mongoose.model('Author', authorSchema);

// Update news-sitemap.xml
async function updateNewsSitemap() {
  try {
    const hagerConnection = await connectToDatabase('hager');
    const articles = await hagerConnection.model('NewsArticle').find({ isPublished: true })
      .populate('authorId', 'name')
      .sort({ createdAt: -1 })
      .limit(1000);
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${articles
  .map(
    (article) => `
  <url>
    <loc>https://mark-elasfar.web.app/article/${article.slug}</loc>
    <news:news>
      <news:publication>
        <news:name>MGZon AI</news:name>
        <news:language>${article.tags.includes('ar') ? 'ar' : 'en'}</news:language>
      </news:publication>
      <news:publication_date>${article.createdAt.toISOString()}</news:publication_date>
      <news:title>${article.title}</news:title>
      <news:keywords>${article.tags.join(',')}</news:keywords>
    </news:news>
  </url>`
  )
  .join('')}
</urlset>`;

    const sitemapPath = path.join(__dirname, 'public', 'news-sitemap.xml');
    await fs.writeFile(sitemapPath, sitemap);
  } catch (error) {
    console.error('Error updating news sitemap:', error);
  }
}

// API Endpoints for hager database
app.post('/articles', async (req, res) => {
  try {
    const connection = await connectToDatabase('hager');
    const NewsArticle = connection.model('NewsArticle', newsArticleSchema);
    const article = new NewsArticle(req.body);
    await article.save();
    await updateNewsSitemap();
    res.json({ success: true, message: 'Article created successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.put('/articles', async (req, res) => {
  try {
    const connection = await connectToDatabase('hager');
    const NewsArticle = connection.model('NewsArticle', newsArticleSchema);
    const { _id, ...data } = req.body;
    await NewsArticle.findByIdAndUpdate(_id, data);
    await updateNewsSitemap();
    res.json({ success: true, message: 'Article updated successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.delete('/articles/:id', async (req, res) => {
  try {
    const connection = await connectToDatabase('hager');
    const NewsArticle = connection.model('NewsArticle', newsArticleSchema);
    await NewsArticle.findByIdAndDelete(req.params.id);
    await updateNewsSitemap();
    res.json({ success: true, message: 'Article deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.get('/articles', async (req, res) => {
  try {
    const connection = await connectToDatabase('hager');
    const NewsArticle = connection.model('NewsArticle', newsArticleSchema);
    const limit = parseInt(req.query.limit) || 10;
    const articles = await NewsArticle.find()
      .populate('authorId', 'name')
      .sort({ createdAt: -1 })
      .limit(limit);
    res.json(articles);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.get('/articles/:slug', async (req, res) => {
  try {
    const connection = await connectToDatabase('hager');
    const NewsArticle = connection.model('NewsArticle', newsArticleSchema);
    const article = await NewsArticle.findOne({ slug: req.params.slug, isPublished: true })
      .populate('authorId', 'name');
    if (!article) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }
    // Increment views
    article.views += 1;
    await article.save();
    res.json({ success: true, ...article.toJSON() });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.post('/articles/:slug/like', async (req, res) => {
  try {
    const connection = await connectToDatabase('hager');
    const NewsArticle = connection.model('NewsArticle', newsArticleSchema);
    const article = await NewsArticle.findOne({ slug: req.params.slug, isPublished: true });
    if (!article) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }
    article.likes += 1;
    await article.save();
    res.json({ success: true, likes: article.likes });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.post('/articles/:slug/boost', async (req, res) => {
  try {
    const connection = await connectToDatabase('hager');
    const NewsArticle = connection.model('NewsArticle', newsArticleSchema);
    const article = await NewsArticle.findOne({ slug: req.params.slug, isPublished: true });
    if (!article) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }
    const now = new Date();
    const createdAt = new Date(article.createdAt);
    const hoursSincePublished = (now - createdAt) / (1000 * 60 * 60);
    
    // Boost likes: 2000 in first hour, up to 10000
    if (hoursSincePublished <= 1 && article.likes < 2000) {
      article.likes = Math.min(article.likes + 2000, 10000);
    } else if (article.likes < 10000) {
      article.likes = Math.min(article.likes + 100, 10000);
    }
    
    // Boost views: Same logic
    if (hoursSincePublished <= 1 && article.views < 2000) {
      article.views = Math.min(article.views + 2000, 10000);
    } else if (article.views < 10000) {
      article.views = Math.min(article.views + 100, 10000);
    }
    
    await article.save();
    res.json({ success: true, likes: article.likes, views: article.views });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.get('/authors', async (req, res) => {
  try {
    const connection = await connectToDatabase('hager');
    const Author = connection.model('Author', authorSchema);
    const authors = await Author.find().select('name _id userId bio profileImageUrl socialLinks');
    res.json(authors);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.get('/authors/:id', async (req, res) => {
  try {
    const connection = await connectToDatabase('hager');
    const Author = connection.model('Author', authorSchema);
    const author = await Author.findById(req.params.id);
    if (!author) {
      return res.status(404).json({ success: false, message: 'Author not found' });
    }
    res.json(author);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.post('/authors', async (req, res) => {
  try {
    const connection = await connectToDatabase('hager');
    const Author = connection.model('Author', authorSchema);
    const author = new Author(req.body);
    await author.save();
    res.json({ success: true, message: 'Author created successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.put('/authors/:id', async (req, res) => {
  try {
    const connection = await connectToDatabase('hager');
    const Author = connection.model('Author', authorSchema);
    const { _id, ...data } = req.body;
    await Author.findByIdAndUpdate(req.params.id, data);
    res.json({ success: true, message: 'Author updated successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.delete('/authors/:id', async (req, res) => {
  try {
    const connection = await connectToDatabase('hager');
    const Author = connection.model('Author', authorSchema);
    const author = await Author.findByIdAndDelete(req.params.id);
    if (!author) {
      return res.status(404).json({ success: false, message: 'Author not found' });
    }
    res.json({ success: true, message: 'Author deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Endpoints for mgzon database
app.get('/mgzon/articles', async (req, res) => {
  try {
    const connection = await connectToDatabase('mgzon');
    const NewsArticle = connection.model('NewsArticle', newsArticleSchema);
    const limit = parseInt(req.query.limit) || 10;
    const articles = await NewsArticle.find()
      .populate('authorId', 'name')
      .sort({ createdAt: -1 })
      .limit(limit);
    res.json(articles);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.get('/mgzon/articles/:slug', async (req, res) => {
  try {
    const connection = await connectToDatabase('mgzon');
    const NewsArticle = connection.model('NewsArticle', newsArticleSchema);
    const article = await NewsArticle.findOne({ slug: req.params.slug, isPublished: true })
      .populate('authorId', 'name');
    if (!article) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }
    res.json({ success: true, ...article.toJSON() });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.get('/mgzon/authors', async (req, res) => {
  try {
    const connection = await connectToDatabase('mgzon');
    const Author = connection.model('Author', authorSchema);
    const authors = await Author.find().select('name _id userId bio profileImageUrl socialLinks');
    res.json(authors);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

exports.api = functions.https.onRequest(app);