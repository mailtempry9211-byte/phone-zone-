/**
 * PhoneZone Enterprise Offline Website Generator
 * Produces a standalone, single-page offline mirror with dark theme,
 * tabbed navigation (Phones, Repairs, B2B Dealers, Sellers, Customers),
 * instant real-time search, and HD image lightboxes.
 */

export function generateOfflineHTML(
  data: any,
  phoneFolders: Map<string, any>,
  generateFileName: (phone: any, type: string, index?: number) => string
): string {
  const bizName = data.admin_settings?.[0]?.business_name || "PhoneZone Store & Repair";
  const phonesList = data.phones || [];
  const repairsList = data.repairs || [];
  const dealersList = data.dealers || [];
  const batchesList = data.dealer_batches || [];
  const sellersList = data.sellers || [];
  const customersList = data.customers || [];
  const messagesList = data.messages || [];

  const inStockCount = phonesList.filter((p: any) => !p.is_sold).length;
  const soldCount = phonesList.filter((p: any) => p.is_sold).length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${bizName} - Complete Offline Management System</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="app-layout">
        <header class="app-header">
            <div class="brand-bar">
                <div class="brand-logo">📱</div>
                <div>
                    <h1>${bizName}</h1>
                    <p class="subtitle">Complete Offline Enterprise Mirror • Exported on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                </div>
            </div>

            <!-- Stats Bar -->
            <div class="stats-row">
                <div class="stat-pill">
                    <span class="stat-val">${phonesList.length}</span>
                    <span class="stat-lbl">Phones (${inStockCount} Stock / ${soldCount} Sold)</span>
                </div>
                <div class="stat-pill">
                    <span class="stat-val">${repairsList.length}</span>
                    <span class="stat-lbl">Repairs</span>
                </div>
                <div class="stat-pill">
                    <span class="stat-val">${dealersList.length}</span>
                    <span class="stat-lbl">B2B Dealers</span>
                </div>
                <div class="stat-pill">
                    <span class="stat-val">${sellersList.length}</span>
                    <span class="stat-lbl">Sellers</span>
                </div>
                <div class="stat-pill">
                    <span class="stat-val">${customersList.length}</span>
                    <span class="stat-lbl">Customers</span>
                </div>
            </div>

            <!-- Search & Filter Bar -->
            <div class="search-box-wrap">
                <input
                    type="text"
                    id="offlineSearch"
                    placeholder="🔍 Real-time search across active tab (Brand, Model, IMEI, Customer, Phone, Job ID)..."
                    onkeyup="filterActiveTab()"
                />
            </div>

            <!-- Navigation Tabs -->
            <nav class="nav-tabs">
                <button class="tab-btn active" data-tab="tab-phones" onclick="switchTab('tab-phones')">
                    📱 Phones & Inventory (${phonesList.length})
                </button>
                <button class="tab-btn" data-tab="tab-repairs" onclick="switchTab('tab-repairs')">
                    🔧 Workshop Repairs (${repairsList.length})
                </button>
                <button class="tab-btn" data-tab="tab-dealers" onclick="switchTab('tab-dealers')">
                    🏢 B2B Dealers (${dealersList.length})
                </button>
                <button class="tab-btn" data-tab="tab-sellers" onclick="switchTab('tab-sellers')">
                    👤 Sellers (${sellersList.length})
                </button>
                <button class="tab-btn" data-tab="tab-customers" onclick="switchTab('tab-customers')">
                    👥 Customers (${customersList.length})
                </button>
                ${messagesList.length > 0 ? `
                <button class="tab-btn" data-tab="tab-messages" onclick="switchTab('tab-messages')">
                    💬 Messages (${messagesList.length})
                </button>` : ''}
            </nav>
        </header>

        <main class="app-main">
            <!-- TAB 1: PHONES & INVENTORY -->
            <section id="tab-phones" class="tab-content active">
                <div class="tab-header">
                    <h2>Phones & Inventory Records</h2>
                    <span class="count-tag">${phonesList.length} Records</span>
                </div>
                <div class="cards-grid">
                    ${phonesList.map((phone: any) => {
                      const phoneFolder = phoneFolders.get(phone.id);
                      const folderName = phoneFolder?.folderName || '';
                      const seller = sellersList.find((s: any) => s.id === phone.seller_id);
                      const customer = customersList.find((c: any) => c.id === phone.customer_id);
                      const profit = (Number(phone.selling_price) || 0) - (Number(phone.purchase_price) || 0);

                      return `
                        <div class="data-card phone-card">
                            <div class="card-head">
                                <div>
                                    <h3 class="card-title">${phone.phone_name} ${phone.model}</h3>
                                    <span class="meta-sub">${phone.color ? phone.color + ' • ' : ''}${phone.storage || 'Standard Storage'}</span>
                                </div>
                                <span class="badge ${phone.is_sold ? 'badge-sold' : 'badge-available'}">
                                    ${phone.is_sold ? 'SOLD' : 'AVAILABLE'}
                                </span>
                            </div>

                            <div class="details-grid">
                                <div class="detail-item"><strong>IMEI 1:</strong> <code>${phone.imei_number}</code></div>
                                ${phone.imei_2 ? `<div class="detail-item"><strong>IMEI 2:</strong> <code>${phone.imei_2}</code></div>` : ''}
                                <div class="detail-item"><strong>Purchase Price:</strong> <span class="price-val">₹${phone.purchase_price}</span></div>
                                <div class="detail-item"><strong>Selling Price:</strong> <span class="price-val">₹${phone.selling_price}</span></div>
                                <div class="detail-item"><strong>Est. Margin:</strong> <span class="profit-val ${profit >= 0 ? 'profit-pos' : 'profit-neg'}">₹${profit}</span></div>
                                <div class="detail-item"><strong>Condition:</strong> <span class="cond-val">${phone.condition || 'good'}</span></div>
                                <div class="detail-item"><strong>Purchase Date:</strong> ${phone.purchase_date || 'N/A'}</div>
                                <div class="detail-item"><strong>Payment Mode:</strong> ${phone.payment_method || 'cash'}</div>
                            </div>

                            ${seller ? `
                            <div class="info-block seller-block">
                                <h4>👤 Seller Information</h4>
                                <p><strong>Name:</strong> ${seller.name} (${seller.phone})</p>
                                <p><strong>Aadhaar / ID:</strong> ${seller.id_number || 'N/A'}</p>
                                <p><strong>Address:</strong> ${seller.address || 'N/A'}</p>
                            </div>` : ''}

                            ${customer ? `
                            <div class="info-block customer-block">
                                <h4>👥 Buyer Information</h4>
                                <p><strong>Customer Name:</strong> ${customer.name} (${customer.phone})</p>
                                <p><strong>Sold Date:</strong> ${phone.sold_date ? new Date(phone.sold_date).toLocaleDateString() : 'N/A'}</p>
                            </div>` : ''}

                            <!-- Photos & Documents -->
                            ${phone.product_photos && phone.product_photos.length > 0 ? `
                            <div class="gallery-block">
                                <h5>📷 Product Photos</h5>
                                <div class="img-thumbnails">
                                    ${phone.product_photos.map((_: any, idx: number) => `
                                        <img src="${folderName}/${generateFileName(phone, 'product', idx)}" alt="Phone Photo" class="thumb-img" onclick="openImageModal(this.src)" />
                                    `).join('')}
                                </div>
                            </div>` : ''}

                            ${phone.purchase_documents && phone.purchase_documents.length > 0 ? `
                            <div class="gallery-block">
                                <h5>📄 Purchase Documents (Aadhaar / KYC)</h5>
                                <div class="img-thumbnails">
                                    ${phone.purchase_documents.map((_: any, idx: number) => `
                                        <img src="${folderName}/${generateFileName(phone, 'purch_doc', idx)}" alt="Doc" class="thumb-img" onclick="openImageModal(this.src)" />
                                    `).join('')}
                                </div>
                            </div>` : ''}

                            ${phone.payment_proof_photos && phone.payment_proof_photos.length > 0 ? `
                            <div class="gallery-block">
                                <h5>💳 Payment Proof Screenshot</h5>
                                <div class="img-thumbnails">
                                    ${phone.payment_proof_photos.map((_: any, idx: number) => `
                                        <img src="${folderName}/${generateFileName(phone, 'payment_proof', idx)}" alt="Payment Proof" class="thumb-img" onclick="openImageModal(this.src)" />
                                    `).join('')}
                                </div>
                            </div>` : ''}
                        </div>
                      `;
                    }).join('')}
                </div>
            </section>

            <!-- TAB 2: WORKSHOP REPAIRS -->
            <section id="tab-repairs" class="tab-content">
                <div class="tab-header">
                    <h2>Workshop Repairs Pipeline</h2>
                    <span class="count-tag">${repairsList.length} Repair Jobs</span>
                </div>
                <div class="cards-grid">
                    ${repairsList.length === 0 ? `<p class="empty-notice">No repair jobs exported.</p>` : repairsList.map((job: any) => {
                      const balance = (Number(job.total_cost || job.cost) || 0) - (Number(job.advance_paid) || 0);
                      const st = String(job.status || 'pending').toLowerCase();
                      return `
                        <div class="data-card repair-card">
                            <div class="card-head">
                                <div>
                                    <h3 class="card-title">Job #${job.job_number || job.id?.slice(0, 8)}: ${job.brand || ''} ${job.model || 'Device'}</h3>
                                    <span class="meta-sub">Customer: ${job.customer_name || 'Walk-in'} • ${job.customer_phone || ''}</span>
                                </div>
                                <span class="badge badge-status badge-${st}">${st.toUpperCase()}</span>
                            </div>

                            <div class="details-grid">
                                <div class="detail-item"><strong>IMEI / Serial:</strong> <code>${job.imei || 'N/A'}</code></div>
                                <div class="detail-item"><strong>Issue Reported:</strong> ${job.problem_description || job.issue || 'General repair'}</div>
                                <div class="detail-item"><strong>Estimated Cost:</strong> <span class="price-val">₹${job.total_cost || job.cost || 0}</span></div>
                                <div class="detail-item"><strong>Advance Paid:</strong> ₹${job.advance_paid || 0}</div>
                                <div class="detail-item"><strong>Balance Due:</strong> <span class="price-val" style="color: #f59e0b;">₹${balance}</span></div>
                                <div class="detail-item"><strong>Date Received:</strong> ${job.created_at ? new Date(job.created_at).toLocaleDateString() : 'N/A'}</div>
                            </div>
                        </div>
                      `;
                    }).join('')}
                </div>
            </section>

            <!-- TAB 3: B2B DEALERS -->
            <section id="tab-dealers" class="tab-content">
                <div class="tab-header">
                    <h2>B2B Dealers & Wholesale Suppliers</h2>
                    <span class="count-tag">${dealersList.length} Dealers</span>
                </div>
                <div class="cards-grid">
                    ${dealersList.length === 0 ? `<p class="empty-notice">No dealer records exported.</p>` : dealersList.map((dealer: any) => {
                      const dBatches = batchesList.filter((b: any) => b.dealer_id === dealer.id);
                      const totalBatchesAmt = dBatches.reduce((sum: number, b: any) => sum + (Number(b.total_amount) || 0), 0);
                      return `
                        <div class="data-card dealer-card">
                            <div class="card-head">
                                <div>
                                    <h3 class="card-title">${dealer.business_name || dealer.name}</h3>
                                    <span class="meta-sub">Contact Person: ${dealer.name} • Phone: ${dealer.phone}</span>
                                </div>
                                <span class="badge badge-dealer">DEALER</span>
                            </div>

                            <div class="details-grid">
                                <div class="detail-item"><strong>GSTIN / Tax ID:</strong> ${dealer.gstin || 'Unregistered'}</div>
                                <div class="detail-item"><strong>Address:</strong> ${dealer.address || 'N/A'}</div>
                                <div class="detail-item"><strong>Total Batches:</strong> ${dBatches.length}</div>
                                <div class="detail-item"><strong>Total Volume:</strong> <span class="price-val">₹${totalBatchesAmt}</span></div>
                            </div>

                            ${dBatches.length > 0 ? `
                            <div class="batches-subtable">
                                <h5>Recent Purchase Batches:</h5>
                                <ul>
                                    ${dBatches.map((b: any) => `
                                        <li>Batch #${b.batch_number || b.id?.slice(0, 8)} • ${b.total_quantity || 0} Phones • ₹${b.total_amount || 0} (${b.purchase_date || 'N/A'})</li>
                                    `).join('')}
                                </ul>
                            </div>` : ''}
                        </div>
                      `;
                    }).join('')}
                </div>
            </section>

            <!-- TAB 4: SELLERS -->
            <section id="tab-sellers" class="tab-content">
                <div class="tab-header">
                    <h2>Registered Sellers Database</h2>
                    <span class="count-tag">${sellersList.length} Sellers</span>
                </div>
                <div class="cards-grid">
                    ${sellersList.map((seller: any) => `
                        <div class="data-card seller-card">
                            <div class="card-head">
                                <div>
                                    <h3 class="card-title">${seller.name}</h3>
                                    <span class="meta-sub">Phone: ${seller.phone}</span>
                                </div>
                                <span class="badge badge-seller">${seller.id_proof_type || 'Aadhaar'}</span>
                            </div>
                            <div class="details-grid">
                                <div class="detail-item"><strong>ID Number:</strong> <code>${seller.id_number || 'N/A'}</code></div>
                                <div class="detail-item"><strong>Address:</strong> ${seller.address || 'N/A'}</div>
                                <div class="detail-item"><strong>Registered On:</strong> ${seller.created_at ? new Date(seller.created_at).toLocaleDateString() : 'N/A'}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </section>

            <!-- TAB 5: CUSTOMERS -->
            <section id="tab-customers" class="tab-content">
                <div class="tab-header">
                    <h2>Valued Customers & Purchase History</h2>
                    <span class="count-tag">${customersList.length} Customers</span>
                </div>
                <div class="cards-grid">
                    ${customersList.map((customer: any) => `
                        <div class="data-card customer-card">
                            <div class="card-head">
                                <div>
                                    <h3 class="card-title">${customer.name}</h3>
                                    <span class="meta-sub">Phone: ${customer.phone}</span>
                                </div>
                                <span class="badge badge-customer">CUSTOMER</span>
                            </div>
                            <div class="details-grid">
                                <div class="detail-item"><strong>Address:</strong> ${customer.address || 'N/A'}</div>
                                <div class="detail-item"><strong>Added On:</strong> ${customer.created_at ? new Date(customer.created_at).toLocaleDateString() : 'N/A'}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </section>

            <!-- TAB 6: MESSAGES -->
            ${messagesList.length > 0 ? `
            <section id="tab-messages" class="tab-content">
                <div class="tab-header">
                    <h2>Inquiries & Contact Messages</h2>
                    <span class="count-tag">${messagesList.length} Messages</span>
                </div>
                <div class="cards-grid">
                    ${messagesList.map((m: any) => `
                        <div class="data-card message-card">
                            <div class="card-head">
                                <h3 class="card-title">${m.name} (${m.phone || m.email})</h3>
                                <span class="meta-sub">${m.created_at ? new Date(m.created_at).toLocaleDateString() : ''}</span>
                            </div>
                            <p class="msg-text">${m.message || ''}</p>
                        </div>
                    `).join('')}
                </div>
            </section>` : ''}
        </main>
    </div>

    <!-- Image Lightbox Modal -->
    <div id="imageModal" class="modal" onclick="closeImageModal()">
        <span class="close-btn">&times;</span>
        <img class="modal-content" id="modalImage" alt="Full Preview" />
    </div>

    <script>
        function switchTab(tabId) {
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            const activeBtn = document.querySelector('[data-tab="' + tabId + '"]');
            if (activeBtn) activeBtn.classList.add('active');
            const targetPane = document.getElementById(tabId);
            if (targetPane) targetPane.classList.add('active');
            filterActiveTab();
        }

        function filterActiveTab() {
            const query = (document.getElementById('offlineSearch')?.value || '').toLowerCase().trim();
            const activePane = document.querySelector('.tab-content.active');
            if (!activePane) return;
            const cards = activePane.querySelectorAll('.data-card');
            cards.forEach(card => {
                const text = card.innerText.toLowerCase();
                card.style.display = text.includes(query) ? '' : 'none';
            });
        }

        function openImageModal(src) {
            const m = document.getElementById('imageModal');
            const img = document.getElementById('modalImage');
            if (m && img) {
                m.style.display = 'flex';
                img.src = src;
            }
        }
        
        function closeImageModal() {
            const m = document.getElementById('imageModal');
            if (m) m.style.display = 'none';
        }
        
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') closeImageModal();
        });
    </script>
</body>
</html>`;
}

export function generateOfflineCSS(): string {
  return `
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.5;
    color: #e2e8f0;
    background-color: #080c14;
    min-height: 100vh;
}

.app-layout {
    max-width: 1440px;
    margin: 0 auto;
    padding: 24px 20px;
}

.app-header {
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 16px;
    padding: 24px;
    margin-bottom: 24px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
}

.brand-bar {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;
}

.brand-logo {
    font-size: 2.2rem;
    background: linear-gradient(135deg, #10b981, #06b6d4);
    border-radius: 14px;
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 20px rgba(16, 185, 129, 0.4);
}

.brand-bar h1 {
    font-size: 1.8rem;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.5px;
}

.subtitle {
    font-size: 0.85rem;
    color: #94a3b8;
    margin-top: 2px;
}

.stats-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 20px;
}

.stat-pill {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 10px;
    padding: 8px 14px;
    display: flex;
    align-items: center;
    gap: 8px;
}

.stat-val {
    font-size: 1.1rem;
    font-weight: 800;
    color: #10b981;
}

.stat-lbl {
    font-size: 0.8rem;
    color: #cbd5e1;
}

.search-box-wrap {
    margin-bottom: 20px;
}

#offlineSearch {
    width: 100%;
    padding: 14px 18px;
    background: #090e17;
    border: 1px solid #334155;
    border-radius: 12px;
    color: #ffffff;
    font-size: 0.95rem;
    outline: none;
    transition: all 0.2s;
}

#offlineSearch:focus {
    border-color: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.25);
}

.nav-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    border-top: 1px solid #1e293b;
    padding-top: 16px;
}

.tab-btn {
    background: #1e293b;
    color: #cbd5e1;
    border: 1px solid #334155;
    padding: 10px 18px;
    border-radius: 10px;
    font-weight: 700;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s;
}

.tab-btn:hover {
    background: #334155;
    color: #ffffff;
}

.tab-btn.active {
    background: #10b981;
    border-color: #10b981;
    color: #ffffff;
    box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);
}

.tab-content {
    display: none;
}

.tab-content.active {
    display: block;
}

.tab-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
}

.tab-header h2 {
    font-size: 1.4rem;
    font-weight: 800;
    color: #ffffff;
}

.count-tag {
    background: #1e293b;
    color: #10b981;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 700;
    border: 1px solid #334155;
}

.cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: 20px;
}

.data-card {
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 14px;
    padding: 20px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    transition: transform 0.2s, border-color 0.2s;
}

.data-card:hover {
    border-color: #3b82f6;
    transform: translateY(-2px);
}

.card-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
    border-bottom: 1px solid #1e293b;
    padding-bottom: 12px;
}

.card-title {
    font-size: 1.15rem;
    font-weight: 700;
    color: #ffffff;
}

.meta-sub {
    font-size: 0.8rem;
    color: #94a3b8;
    display: block;
    margin-top: 2px;
}

.badge {
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 800;
    text-transform: uppercase;
}

.badge-available { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid #10b981; }
.badge-sold { background: rgba(139, 92, 246, 0.15); color: #a78bfa; border: 1px solid #8b5cf6; }
.badge-dealer { background: rgba(6, 182, 212, 0.15); color: #06b6d4; border: 1px solid #06b6d4; }
.badge-seller { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid #f59e0b; }
.badge-customer { background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid #3b82f6; }

.badge-status.badge-pending { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid #ef4444; }
.badge-status.badge-in_progress { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid #f59e0b; }
.badge-status.badge-completed { background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid #3b82f6; }
.badge-status.badge-delivered { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid #10b981; }

.details-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 14px;
    font-size: 0.85rem;
    margin-bottom: 14px;
}

.detail-item strong {
    color: #94a3b8;
    font-size: 0.8rem;
    display: block;
}

.price-val {
    color: #10b981;
    font-weight: 700;
}

.profit-val { font-weight: 700; }
.profit-pos { color: #10b981; }
.profit-neg { color: #ef4444; }

code {
    font-family: monospace;
    background: #1e293b;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.8rem;
    color: #38bdf8;
}

.info-block {
    background: #090e17;
    border: 1px solid #1e293b;
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 0.8rem;
    margin-bottom: 12px;
}

.info-block h4 {
    font-size: 0.82rem;
    font-weight: 700;
    color: #38bdf8;
    margin-bottom: 6px;
}

.gallery-block {
    margin-top: 12px;
    border-top: 1px solid #1e293b;
    padding-top: 10px;
}

.gallery-block h5 {
    font-size: 0.78rem;
    color: #94a3b8;
    margin-bottom: 8px;
}

.img-thumbnails {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.thumb-img {
    width: 64px;
    height: 64px;
    object-fit: cover;
    border-radius: 6px;
    border: 1px solid #334155;
    cursor: pointer;
    transition: transform 0.2s;
}

.thumb-img:hover {
    transform: scale(1.08);
    border-color: #10b981;
}

.batches-subtable {
    margin-top: 12px;
    background: #090e17;
    padding: 10px;
    border-radius: 8px;
    font-size: 0.8rem;
}

.batches-subtable h5 {
    color: #06b6d4;
    margin-bottom: 6px;
}

.batches-subtable ul {
    list-style: none;
    padding-left: 0;
}

.batches-subtable li {
    padding: 3px 0;
    border-bottom: 1px solid #1e293b;
}

.empty-notice {
    grid-column: 1 / -1;
    text-align: center;
    padding: 40px;
    color: #64748b;
    font-size: 0.95rem;
}

/* Lightbox Modal */
.modal {
    display: none;
    position: fixed;
    z-index: 1000;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.9);
    align-items: center;
    justify-content: center;
}

.modal-content {
    max-width: 90%;
    max-height: 85%;
    border-radius: 8px;
    box-shadow: 0 0 30px rgba(0, 0, 0, 0.8);
}

.close-btn {
    position: absolute;
    top: 20px;
    right: 30px;
    color: #f1f5f9;
    font-size: 40px;
    font-weight: bold;
    cursor: pointer;
}

@media (max-width: 768px) {
    .cards-grid {
        grid-template-columns: 1fr;
    }
    .stats-row {
        flex-direction: column;
    }
    .nav-tabs {
        flex-direction: column;
    }
    .tab-btn {
        width: 100%;
        text-align: center;
    }
}
`;
}
