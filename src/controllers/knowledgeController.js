import KnowledgeSource from '../models/KnowledgeSource.js';

export const getKnowledgeSources = async (req, res) => {
  try {
    let sources = await KnowledgeSource.find().sort({ createdAt: -1 });

    if (sources.length === 0) {
      const seeded = [
        {
          title: 'Return & Refund Policy v2.4 (Current)',
          type: 'document',
          status: 'indexed',
          authorityLevel: 5,
          chunks: [
            { heading: 'Eligibility', content: 'Customers are eligible for a 100% refund within 14 days of purchase with receipt.', page: 1 },
            { heading: 'Cancellation', content: 'Appointments cancelled at least 24 hours prior incur no cancellation fee.', page: 1 },
            { heading: 'Processing Time', content: 'Approved refunds are credited to the original payment method within 3 to 5 business days.', page: 2 },
          ],
          chunkCount: 3,
        },
        {
          title: 'Enterprise Pricing & SLA Agreement',
          type: 'pdf',
          status: 'indexed',
          authorityLevel: 4,
          chunks: [
            { heading: 'Starter Tier', content: 'Starter tier is priced at $49/mo and includes 2 AI agents and 500 included minutes.', page: 1 },
            { heading: 'Growth Tier', content: 'Growth tier is priced at $129/mo (or ₹6,999 / S$149) and includes 6 AI agents, full multi-pipeline CRM, and social media scheduling.', page: 2 },
            { heading: 'Uptime Guarantee', content: 'Enterprise tier provides 99.95% uptime SLA with dedicated priority support.', page: 3 },
          ],
          chunkCount: 3,
        },
        {
          title: 'Clinic & Salon Booking Procedures',
          type: 'faq',
          status: 'indexed',
          authorityLevel: 4,
          chunks: [
            { heading: 'Walk-ins vs Appointments', content: 'Walk-ins are welcomed subject to doctor and stylist availability; pre-booked appointments are prioritized.', page: 1 },
            { heading: 'Reminders', content: 'Automated WhatsApp confirmations go out 24 hours prior to the slot via GoWhats.', page: 1 },
          ],
          chunkCount: 2,
        },
      ];
      sources = await KnowledgeSource.insertMany(seeded);
    }

    res.json({ success: true, count: sources.length, data: sources });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createKnowledgeSource = async (req, res) => {
  try {
    const { title, type, rawContent, sourceUrl, authorityLevel } = req.body;

    // Simple heading-aware chunking
    const paragraphs = (rawContent || '').split(/\n\n+/).filter(Boolean);
    const chunks = paragraphs.map((p, index) => {
      const firstLine = p.split('\n')[0].replace(/^#+\s*/, '');
      return {
        heading: firstLine.length < 40 ? firstLine : `Section ${index + 1}`,
        content: p,
        page: Math.floor(index / 3) + 1,
      };
    });

    const source = new KnowledgeSource({
      title,
      type: type || 'document',
      rawContent,
      sourceUrl,
      status: 'indexed',
      authorityLevel: authorityLevel || 3,
      chunks: chunks.length > 0 ? chunks : [{ heading: 'General', content: rawContent || title }],
      chunkCount: chunks.length || 1,
    });

    await source.save();
    res.status(201).json({ success: true, data: source });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const testKnowledgeRetrieval = async (req, res) => {
  try {
    const { query, agentId } = req.body;
    const sources = await KnowledgeSource.find({ status: 'indexed' });

    const qLower = (query || '').toLowerCase();
    let bestMatch = null;
    let highestScore = 0;

    for (const src of sources) {
      for (const chunk of src.chunks) {
        const cLower = chunk.content.toLowerCase();
        let matchScore = 0;
        const words = qLower.split(/\s+/).filter((w) => w.length > 2);
        for (const word of words) {
          if (cLower.includes(word)) matchScore += 1;
        }
        const confidence = words.length > 0 ? Math.min(matchScore / words.length, 0.98) : 0.4;
        if (confidence > highestScore) {
          highestScore = confidence;
          bestMatch = {
            sourceTitle: src.title,
            heading: chunk.heading,
            passage: chunk.content,
            page: chunk.page,
            confidence: Math.round(confidence * 100),
          };
        }
      }
    }

    if (!bestMatch || highestScore < 0.25) {
      return res.json({
        success: true,
        grounded: false,
        confidence: Math.round(highestScore * 100),
        message: 'No authoritative knowledge passage found matching the query above confidence threshold.',
      });
    }

    res.json({
      success: true,
      grounded: true,
      data: bestMatch,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
