'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from '@clinic/config';
import { Button, Modal, Input } from '@clinic/ui';

interface Article {
  article_id: string;
  title: string;
  slug: string;
  excerpt?: string;
  category?: string;
  is_published: boolean;
  view_count: number;
  created_at: string;
}

export default function ArticlesPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || supabaseConfig.url,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || supabaseConfig.anonKey
  );

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    excerpt: '',
    category: '',
    content: '',
  });

  useEffect(() => {
    loadArticles();
  }, []);

  async function loadArticles() {
    try {
      const { data } = await supabase
        .from('articles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      setArticles(data || []);
    } catch (error) {
      console.error('Error loading articles:', error);
    } finally {
      setLoading(false);
    }
  }

  function openNewArticleModal() {
    setEditingArticle(null);
    setFormData({ title: '', excerpt: '', category: '', content: '' });
    setShowModal(true);
  }

  function openEditModal(article: Article) {
    setEditingArticle(article);
    setFormData({
      title: article.title,
      excerpt: article.excerpt || '',
      category: article.category || '',
      content: '',
    });
    setShowModal(true);
  }

  async function saveArticle() {
    try {
      if (editingArticle) {
        // Update
        await supabase
          .from('articles')
          .update({
            title: formData.title,
            excerpt: formData.excerpt,
            category: formData.category,
            updated_at: new Date().toISOString(),
          })
          .eq('article_id', editingArticle.article_id);
      } else {
        // Create
        const slug = formData.title
          .toLowerCase()
          .replace(/[^a-z0-9ก-๙\s]/g, '')
          .replace(/\s+/g, '-')
          .substring(0, 50);

        await supabase.from('articles').insert({
          clinic_id: 'demo-clinic-id',
          title: formData.title,
          slug,
          excerpt: formData.excerpt,
          category: formData.category,
          content: formData.content,
          author_id: 'demo-admin-id',
          is_published: false,
        });
      }

      setShowModal(false);
      loadArticles();
    } catch (error) {
      console.error('Error saving article:', error);
    }
  }

  async function togglePublish(articleId: string, currentStatus: boolean) {
    try {
      await supabase
        .from('articles')
        .update({
          is_published: !currentStatus,
          published_at: !currentStatus ? new Date().toISOString() : null,
        })
        .eq('article_id', articleId);

      loadArticles();
    } catch (error) {
      console.error('Error updating article:', error);
    }
  }

  async function deleteArticle(articleId: string) {
    if (!confirm('คุณต้องการลบบทความนี้ใช่ไหม?')) return;

    try {
      await supabase.from('articles').delete().eq('article_id', articleId);
      loadArticles();
    } catch (error) {
      console.error('Error deleting article:', error);
    }
  }

  const filteredArticles = articles.filter(article =>
    article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    article.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">จัดการบทความ</h1>
            <Button onClick={openNewArticleModal}>+ เพิ่มบทความ</Button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-8">
            <a href="/dashboard" className="py-4 text-sm font-medium text-gray-600 hover:text-gray-900">
              ภาพรวม
            </a>
            <a href="/doctors" className="py-4 text-sm font-medium text-gray-600 hover:text-gray-900">
              แพทย์
            </a>
            <a href="/patients" className="py-4 text-sm font-medium text-gray-600 hover:text-gray-900">
              คนไข้
            </a>
            <a href="/appointments" className="py-4 text-sm font-medium text-gray-600 hover:text-gray-900">
              นัดหมาย
            </a>
            <a href="/articles" className="py-4 text-sm font-medium text-primary border-b-2 border-primary">
              บทความ
            </a>
            <a href="/reports" className="py-4 text-sm font-medium text-gray-600 hover:text-gray-900">
              รายงาน
            </a>
            <a href="/settings" className="py-4 text-sm font-medium text-gray-600 hover:text-gray-900">
              ตั้งค่า
            </a>
          </div>
        </div>
      </nav>

      {/* Search */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <input
            type="text"
            placeholder="ค้นหาบทความ..."
            className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    ชื่อบทความ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    หมวดหมู่
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    สถานะ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    เข้าชม
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    จัดการ
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredArticles.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      ไม่พบบทความ
                    </td>
                  </tr>
                ) : (
                  filteredArticles.map((article) => (
                    <tr key={article.article_id}>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{article.title}</div>
                        {article.excerpt && (
                          <div className="text-xs text-gray-500 mt-1 truncate max-w-xs">
                            {article.excerpt}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {article.category || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          article.is_published
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {article.is_published ? 'เผยแพร่' : 'ฉบับร่าง'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {article.view_count.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => openEditModal(article)}
                          className="text-blue-600 hover:text-blue-800 mr-3"
                        >
                          แก้ไข
                        </button>
                        <button
                          onClick={() => togglePublish(article.article_id, article.is_published)}
                          className="text-green-600 hover:text-green-800 mr-3"
                        >
                          {article.is_published ? 'ซ่อน' : 'เผยแพร่'}
                        </button>
                        <button
                          onClick={() => deleteArticle(article.article_id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          ลบ
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingArticle ? 'แก้ไขบทความ' : 'เพิ่มบทความใหม่'}
        size="lg"
        footer={
          <>
            <button
              onClick={() => setShowModal(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              ยกเลิก
            </button>
            <Button onClick={saveArticle}>บันทึก</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="ชื่อบทความ"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="กรอกชื่อบทความ"
          />
          <Input
            label="หมวดหมู่"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            placeholder="เช่น สุขภาพ, โรคฟันแท้, ทันตกรรมเฉพาะทาง"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              คำอธิบายย่อย
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              rows={3}
              value={formData.excerpt}
              onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
              placeholder="คำอธิบายย่อยของบทความ"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              เนื้อหา
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              rows={10}
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="เนื้อหาบทความ (รองรับ Markdown)"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
