/**
 * PhoneZone Enterprise Offline Website Generator
 * Produces a standalone, single-page offline mirror matching the live software:
 * - Full Dark Theme matching PhoneZone Production UI
 * - Complete Workshop Repairs with live schema (job_no, device_brand, device_model, problem, financials, warranty)
 * - Complete B2B Dealers with live schema (shop_name, proprietor_name, batches, volume)
 * - Rich Sellers Database with Profile Photo, Digital Signature, Aadhaar KYC & Sold Devices History
 * - Valued Customers with Purchase History & Lifetime Spend
 * - Phones & Inventory with Sub-Tabs (All, In Stock, Sold) featuring realized profit margins & buyer details
 * - Real-time search & interactive image lightboxes
 */

export function generateOfflineHTML(
  data: any,
  phoneFolders: Map<string, any>,
  generateFileName: (phone: any, type: string, index?: number) => string
): string {
  const bizName = data.admin_settings?.[0]?.business_name || "PhoneZone Store & Repair";
  const phonesList = data.phones || [];
  const repairsList = data.repairs || [];
  const repairCustomersList = data.repair_customers || [];
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
    <title>${bizName} - Complete Offline Enterprise Mirror</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="app-layout">
        <!-- HEADER -->
        <header class="app-header">
            <div class="brand-bar">
                <div class="brand-logo">📱</div>
                <div class="brand-info">
                    <h1>${bizName}</h1>
                    <p class="subtitle">Complete Offline Enterprise Mirror • Exported on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} • 100% Offline Accessible</p>
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
                    <span class="stat-lbl">Workshop Repairs</span>
                </div>
                <div class="stat-pill">
                    <span class="stat-val">${dealersList.length}</span>
                    <span class="stat-lbl">B2B Dealers</span>
                </div>
                <div class="stat-pill">
                    <span class="stat-val">${sellersList.length}</span>
                    <span class="stat-lbl">Registered Sellers</span>
                </div>
                <div class="stat-pill">
                    <span class="stat-val">${customersList.length}</span>
                    <span class="stat-lbl">Customers</span>
                </div>
            </div>

            <!-- Search Bar -->
            <div class="search-box-wrap">
                <input
                    type="text"
                    id="offlineSearch"
                    placeholder="🔍 Real-time search across active tab (Brand, Model, IMEI, Customer, Phone, Job ID, Dealer)..."
                    onkeyup="filterActiveTab()"
                />
            </div>

            <!-- Main Navigation Tabs -->
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
                    👤 Registered Sellers (${sellersList.length})
                </button>
                <button class="tab-btn" data-tab="tab-customers" onclick="switchTab('tab-customers')">
                    👥 Valued Customers (${customersList.length})
                </button>
                ${messagesList.length > 0 ? `
                <button class="tab-btn" data-tab="tab-messages" onclick="switchTab('tab-messages')">
                    💬 Messages (${messagesList.length})
                </button>` : ''}
            </nav>
        </header>

        <main class="app-main">
            <!-- ========================================== -->
            <!-- TAB 1: PHONES & INVENTORY -->
            <!-- ========================================== -->
            <section id="tab-phones" class="tab-content active">
                <div class="tab-header">
                    <div>
                        <h2>Phones & Inventory Records</h2>
                        <span class="meta-sub">Complete catalog of current stock and historical sales</span>
                    </div>
                    <!-- Sub-filter Pills -->
                    <div class="subfilter-group">
                        <button class="sub-btn active" onclick="filterPhoneStock('all', this)">All (${phonesList.length})</button>
                        <button class="sub-btn" onclick="filterPhoneStock('instock', this)">In Stock (${inStockCount})</button>
                        <button class="sub-btn" onclick="filterPhoneStock('sold', this)">Sold (${soldCount})</button>
                    </div>
                </div>

                <div class="cards-grid">
                    ${phonesList.length === 0 ? `<p class="empty-notice">No phone records exported.</p>` : phonesList.map((phone: any) => {
                      const phoneFolder = phoneFolders.get(phone.id);
                      const folderName = phoneFolder?.folderName || '';
                      const seller = sellersList.find((s: any) => s.id === phone.seller_id);
                      const customer = customersList.find((c: any) => c.id === phone.customer_id);
                      
                      const purchasePrice = Number(phone.purchase_price) || 0;
                      const sellingPrice = Number(phone.selling_price) || 0;
                      const soldPrice = Number(phone.sold_price) || sellingPrice;
                      const profit = phone.is_sold ? (soldPrice - purchasePrice) : (sellingPrice - purchasePrice);

                      const sellerPhotoSrc = phone._local_seller_photo 
                        ? `${folderName}/${phone._local_seller_photo}` 
                        : (seller?._local_photo || (phone.seller_photo_url && phone.seller_photo_url.startsWith('data:') ? phone.seller_photo_url : (seller?.seller_photo_url && seller.seller_photo_url.startsWith('data:') ? seller.seller_photo_url : '')));

                      const sellerSigSrc = phone._local_seller_signature
                        ? `${folderName}/${phone._local_seller_signature}`
                        : (seller?._local_signature || (phone.seller_signature_url && phone.seller_signature_url.startsWith('data:') ? phone.seller_signature_url : (seller?.seller_signature_url && seller.seller_signature_url.startsWith('data:') ? seller.seller_signature_url : '')));

                      return `
                        <div class="data-card phone-card ${phone.is_sold ? 'phone-is-sold' : 'phone-in-stock'}" data-stock="${phone.is_sold ? 'sold' : 'instock'}">
                            <div class="card-head">
                                <div>
                                    <h3 class="card-title">${phone.phone_name || ''} ${phone.model || ''}</h3>
                                    <span class="meta-sub">${phone.color ? phone.color + ' • ' : ''}${phone.storage || 'Standard Storage'} ${phone.battery_health ? '• Health: ' + phone.battery_health + '%' : ''}</span>
                                </div>
                                <span class="badge ${phone.is_sold ? 'badge-sold' : 'badge-available'}">
                                    ${phone.is_sold ? 'SOLD' : 'AVAILABLE'}
                                </span>
                            </div>

                            <div class="details-grid">
                                <div class="detail-item"><strong>IMEI 1:</strong> <code>${phone.imei_number || 'N/A'}</code></div>
                                ${phone.imei_2 ? `<div class="detail-item"><strong>IMEI 2:</strong> <code>${phone.imei_2}</code></div>` : ''}
                                <div class="detail-item"><strong>Purchase Price:</strong> <span class="price-val">₹${purchasePrice.toLocaleString('en-IN')}</span></div>
                                <div class="detail-item"><strong>${phone.is_sold ? 'Sold Price:' : 'Selling Price:'}</strong> <span class="price-val">₹${(phone.is_sold ? soldPrice : sellingPrice).toLocaleString('en-IN')}</span></div>
                                <div class="detail-item"><strong>${phone.is_sold ? 'Realized Profit:' : 'Est. Margin (+20%):'}</strong> <span class="profit-val ${profit >= 0 ? 'profit-pos' : 'profit-neg'}">₹${profit.toLocaleString('en-IN')}</span></div>
                                <div class="detail-item"><strong>Condition:</strong> <span class="cond-val">${(phone.condition || 'good').toUpperCase()}</span></div>
                                <div class="detail-item"><strong>Purchase Date:</strong> ${phone.purchase_date || 'N/A'}</div>
                                <div class="detail-item"><strong>Payment Mode:</strong> ${(phone.payment_method || 'cash').toUpperCase()}</div>
                            </div>

                            ${phone.is_sold ? `
                            <div class="info-block customer-block">
                                <h4>🎉 Buyer & Sale Information</h4>
                                <p><strong>Customer:</strong> ${customer?.name || phone.buyer_name || 'Walk-in Customer'} ${customer?.phone ? `(${customer.phone})` : ''}</p>
                                <p><strong>Sold Date:</strong> ${phone.sold_date ? new Date(phone.sold_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}</p>
                                <p><strong>Net Profit Realized:</strong> <span class="profit-pos" style="font-weight: 700;">₹${profit.toLocaleString('en-IN')}</span></p>
                            </div>` : ''}

                            <!-- Seller Info & Signature Block -->
                            ${(seller || phone.seller_name || sellerPhotoSrc || sellerSigSrc) ? `
                            <div class="info-block seller-block">
                                <h4>👤 Seller & Sapath Patra Details</h4>
                                <div class="seller-preview-row">
                                    ${sellerPhotoSrc ? `
                                    <div class="seller-photo-wrap">
                                        <img src="${sellerPhotoSrc}" alt="Seller Photo" class="seller-mini-photo" onclick="openImageModal(this.src)" title="Click to view seller photo" />
                                    </div>` : ''}
                                    <div class="seller-text-wrap">
                                        <p><strong>Name:</strong> ${seller?.name || phone.seller_name || 'Registered Seller'}</p>
                                        <p><strong>Phone:</strong> ${seller?.phone || phone.seller_phone || 'N/A'}</p>
                                        <p><strong>ID Proof:</strong> ${(seller?.id_proof_type || 'Aadhaar').toUpperCase()} - <code>${seller?.id_number || phone.seller_id_number || 'Verified'}</code></p>
                                        ${seller?.address ? `<p class="seller-addr"><strong>Address:</strong> ${seller.address}</p>` : ''}
                                    </div>
                                    ${sellerSigSrc ? `
                                    <div class="signature-wrap" title="Digital Signature">
                                        <span class="sig-label">Digital Signature</span>
                                        <img src="${sellerSigSrc}" alt="Seller Signature" class="seller-mini-sig" onclick="openImageModal(this.src)" />
                                    </div>` : ''}
                                </div>
                            </div>` : ''}

                            <!-- Photos & Documents -->
                            ${phone.product_photos && phone.product_photos.length > 0 ? `
                            <div class="gallery-block">
                                <h5>📷 Product Photos (${phone.product_photos.length})</h5>
                                <div class="img-thumbnails">
                                    ${phone.product_photos.map((photoUrl: string, idx: number) => {
                                      const imgSrc = photoUrl.startsWith('data:') ? photoUrl : `${folderName}/${generateFileName(phone, 'product', idx)}`;
                                      return `<img src="${imgSrc}" alt="Product Photo ${idx + 1}" class="thumb-img" onclick="openImageModal(this.src)" onerror="this.style.display='none'" />`;
                                    }).join('')}
                                </div>
                            </div>` : ''}

                            ${phone.purchase_documents && phone.purchase_documents.length > 0 ? `
                            <div class="gallery-block">
                                <h5>📄 Purchase Documents (Aadhaar / KYC)</h5>
                                <div class="img-thumbnails">
                                    ${phone.purchase_documents.map((docUrl: string, idx: number) => {
                                      const docSrc = docUrl.startsWith('data:') ? docUrl : `${folderName}/${generateFileName(phone, 'purch_doc', idx)}`;
                                      return `<img src="${docSrc}" alt="Document ${idx + 1}" class="thumb-img" onclick="openImageModal(this.src)" onerror="this.style.display='none'" />`;
                                    }).join('')}
                                </div>
                            </div>` : ''}

                            ${phone.payment_proof_photos && phone.payment_proof_photos.length > 0 ? `
                            <div class="gallery-block">
                                <h5>💳 Payment Proof Screenshot</h5>
                                <div class="img-thumbnails">
                                    ${phone.payment_proof_photos.map((proofUrl: string, idx: number) => {
                                      const proofSrc = proofUrl.startsWith('data:') ? proofUrl : `${folderName}/${generateFileName(phone, 'payment_proof', idx)}`;
                                      return `<img src="${proofSrc}" alt="Payment Proof" class="thumb-img" onclick="openImageModal(this.src)" onerror="this.style.display='none'" />`;
                                    }).join('')}
                                </div>
                            </div>` : ''}
                        </div>
                      `;
                    }).join('')}
                </div>
            </section>

            <!-- ========================================== -->
            <!-- TAB 2: WORKSHOP REPAIRS -->
            <!-- ========================================== -->
            <section id="tab-repairs" class="tab-content">
                <div class="tab-header">
                    <div>
                        <h2>Workshop Repairs Pipeline</h2>
                        <span class="meta-sub">Complete job card tickets, problems reported, technician assignments, and payment statuses</span>
                    </div>
                    <span class="count-tag">${repairsList.length} Repair Jobs</span>
                </div>
                <div class="cards-grid">
                    ${repairsList.length === 0 ? `<p class="empty-notice">No repair jobs exported.</p>` : repairsList.map((job: any) => {
                      const brand = (job.device_brand || job.brand || '').toUpperCase();
                      const model = (job.device_model || job.model || 'Device').toUpperCase();
                      const jobNo = job.job_no || job.job_number || `JOB-${job.id?.slice(0, 8)}`;
                      const problem = job.problem || job.problem_description || job.issue || 'General repair';
                      const cost = Number(job.final_price || job.estimate || job.total_cost || job.cost) || 0;
                      const advance = Number(job.advance_paid) || 0;
                      const balance = cost - advance;
                      const status = String(job.status || 'pending').toLowerCase();
                      const payStatus = String(job.payment_status || (balance <= 0 ? 'paid' : 'pending')).toLowerCase();

                      // Resolve Customer
                      const repairCust = repairCustomersList.find((c: any) => c.id === job.repair_customer_id || c.id === job.customer_id) 
                        || customersList.find((c: any) => c.id === job.repair_customer_id || c.id === job.customer_id);
                      const customerName = job.customer_name || repairCust?.name || 'Walk-in Customer';
                      const customerPhone = job.customer_phone || repairCust?.phone || '';

                      return `
                        <div class="data-card repair-card">
                            <div class="card-head">
                                <div>
                                    <h3 class="card-title">${brand} ${model}</h3>
                                    <span class="meta-sub">Job Ticket: <code>${jobNo}</code> • FY ${job.financial_year || '2026-27'}</span>
                                </div>
                                <div class="badge-stack">
                                    <span class="badge badge-status badge-${status}">${status.toUpperCase()}</span>
                                    <span class="badge ${payStatus === 'paid' ? 'badge-available' : 'badge-status badge-pending'}">${payStatus.toUpperCase()}</span>
                                </div>
                            </div>

                            <div class="customer-strip">
                                <strong>👤 Customer:</strong> ${customerName} ${customerPhone ? `(📞 ${customerPhone})` : ''}
                            </div>

                            <div class="problem-box">
                                <strong>⚠️ Issue Reported:</strong>
                                <p>${problem.replace(/\\n/g, '<br/>')}</p>
                            </div>

                            <div class="details-grid">
                                <div class="detail-item"><strong>IMEI / Serial:</strong> <code>${job.imei || job.imei_number || 'N/A'}</code></div>
                                <div class="detail-item"><strong>Technician:</strong> ${job.technician || 'Main Workshop'}</div>
                                <div class="detail-item"><strong>Total Charge:</strong> <span class="price-val">₹${cost.toLocaleString('en-IN')}</span></div>
                                <div class="detail-item"><strong>Advance Paid:</strong> ₹${advance.toLocaleString('en-IN')}</div>
                                <div class="detail-item"><strong>Balance Due:</strong> <span class="profit-val ${balance <= 0 ? 'profit-pos' : 'profit-neg'}">₹${balance.toLocaleString('en-IN')}</span></div>
                                <div class="detail-item"><strong>Warranty:</strong> <span class="cond-val">${job.warranty_days ? job.warranty_days + ' Days' : 'No Warranty'}</span></div>
                                <div class="detail-item"><strong>Received Date:</strong> ${job.received_at ? new Date(job.received_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : (job.created_at ? new Date(job.created_at).toLocaleDateString() : 'N/A')}</div>
                                <div class="detail-item"><strong>Delivered Date:</strong> ${job.delivered_at ? new Date(job.delivered_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Pending Delivery'}</div>
                            </div>

                            ${(job.accessories_received || job.passcode_note) ? `
                            <div class="info-block">
                                ${job.accessories_received ? `<p><strong>📦 Accessories Received:</strong> ${job.accessories_received}</p>` : ''}
                                ${job.passcode_note ? `<p><strong>🔑 Passcode / Pattern:</strong> <code>${job.passcode_note}</code></p>` : ''}
                            </div>` : ''}
                        </div>
                      `;
                    }).join('')}
                </div>
            </section>

            <!-- ========================================== -->
            <!-- TAB 3: B2B DEALERS -->
            <!-- ========================================== -->
            <section id="tab-dealers" class="tab-content">
                <div class="tab-header">
                    <div>
                        <h2>B2B Wholesale Dealers & Suppliers</h2>
                        <span class="meta-sub">Wholesale partner ledgers, GSTIN details, and batch purchase invoices</span>
                    </div>
                    <span class="count-tag">${dealersList.length} Dealers</span>
                </div>
                <div class="cards-grid">
                    ${dealersList.length === 0 ? `<p class="empty-notice">No dealer records exported.</p>` : dealersList.map((dealer: any) => {
                      const shopName = dealer.shop_name || dealer.business_name || dealer.name || 'Wholesale Supplier';
                      const propName = dealer.proprietor_name || dealer.name || 'N/A';
                      const dBatches = batchesList.filter((b: any) => b.dealer_id === dealer.id);
                      const totalBatchesAmt = dBatches.reduce((sum: number, b: any) => sum + (Number(b.total_amount) || 0), 0);
                      const totalPhonesPurchased = dBatches.reduce((sum: number, b: any) => sum + (Number(b.total_phones || b.total_quantity) || 0), 0);

                      const dealerPhoto = dealer._local_photo || (dealer.photo_url && dealer.photo_url.startsWith('data:') ? dealer.photo_url : '');
                      const dealerSig = dealer._local_signature || (dealer.signature_url && dealer.signature_url.startsWith('data:') ? dealer.signature_url : '');

                      return `
                        <div class="data-card dealer-card">
                            <div class="card-head">
                                <div>
                                    <h3 class="card-title">${shopName}</h3>
                                    <span class="meta-sub">Proprietor: ${propName} • Phone: ${dealer.phone || 'N/A'}</span>
                                </div>
                                <span class="badge badge-dealer">B2B DEALER</span>
                            </div>

                            <div class="seller-preview-row" style="margin-bottom: 14px;">
                                ${dealerPhoto ? `
                                <div class="seller-photo-wrap">
                                    <img src="${dealerPhoto}" alt="Dealer Photo" class="seller-mini-photo" onclick="openImageModal(this.src)" title="Dealer Photo" />
                                </div>` : ''}
                                <div class="seller-text-wrap">
                                    <p><strong>Address:</strong> ${dealer.address || 'N/A'}${dealer.city ? ', ' + dealer.city : ''}${dealer.state ? ', ' + dealer.state : ''}</p>
                                    <p><strong>GST Number:</strong> <code>${dealer.gst_number || dealer.gstin || 'Unregistered'}</code></p>
                                    <p><strong>PAN Number:</strong> <code>${dealer.pan_number || 'N/A'}</code></p>
                                    ${dealer.alternate_phone ? `<p><strong>Alt Phone:</strong> ${dealer.alternate_phone}</p>` : ''}
                                </div>
                                ${dealerSig ? `
                                <div class="signature-wrap" title="Dealer Signature">
                                    <span class="sig-label">Dealer Signature</span>
                                    <img src="${dealerSig}" alt="Signature" class="seller-mini-sig" onclick="openImageModal(this.src)" />
                                </div>` : ''}
                            </div>

                            <div class="details-grid">
                                <div class="detail-item"><strong>Total Batches:</strong> <span class="price-val">${dBatches.length} Batches</span></div>
                                <div class="detail-item"><strong>Total Phones:</strong> <span class="price-val">${totalPhonesPurchased} Devices</span></div>
                                <div class="detail-item"><strong>Total Business Volume:</strong> <span class="price-val">₹${totalBatchesAmt.toLocaleString('en-IN')}</span></div>
                                <div class="detail-item"><strong>Current Balance:</strong> <span class="${Number(dealer.balance) > 0 ? 'profit-neg' : 'profit-pos'}">₹${(Number(dealer.balance) || 0).toLocaleString('en-IN')}</span></div>
                            </div>

                            ${dBatches.length > 0 ? `
                            <div class="batches-subtable">
                                <h5>📦 Recent Purchase Batches (${dBatches.length})</h5>
                                <ul>
                                    ${dBatches.map((b: any) => `
                                        <li>
                                            <strong>${b.invoice_number || `Batch #${b.id?.slice(0, 8)}`}</strong> • 
                                            <span>${b.total_phones || b.total_quantity || 0} Phones</span> • 
                                            <span class="price-val">₹${(Number(b.total_amount) || 0).toLocaleString('en-IN')}</span> • 
                                            <span>${(b.payment_method || 'UPI').toUpperCase()}</span> • 
                                            <span style="color: #94a3b8;">${b.purchase_date || 'N/A'}</span>
                                        </li>
                                    `).join('')}
                                </ul>
                            </div>` : ''}
                        </div>
                      `;
                    }).join('')}
                </div>
            </section>

            <!-- ========================================== -->
            <!-- TAB 4: REGISTERED SELLERS -->
            <!-- ========================================== -->
            <section id="tab-sellers" class="tab-content">
                <div class="tab-header">
                    <div>
                        <h2>Registered Sellers Database</h2>
                        <span class="meta-sub">Profiles, photo identification, digital signatures, legal sapath patra records, and sold phone histories</span>
                    </div>
                    <span class="count-tag">${sellersList.length} Sellers</span>
                </div>
                <div class="cards-grid">
                    ${sellersList.length === 0 ? `<p class="empty-notice">No seller records exported.</p>` : sellersList.map((seller: any) => {
                      const relatedPhones = phonesList.filter((p: any) => p.seller_id === seller.id || p.seller_phone === seller.phone);
                      const totalPaid = relatedPhones.reduce((sum: number, p: any) => sum + (Number(p.purchase_price) || 0), 0);

                      // Image resolution
                      const sellerPhoto = seller._local_photo || (seller.seller_photo_url && seller.seller_photo_url.startsWith('data:') ? seller.seller_photo_url : '');
                      const sellerSig = seller._local_signature || (seller.seller_signature_url && seller.seller_signature_url.startsWith('data:') ? seller.seller_signature_url : (relatedPhones.find((p: any) => p.seller_signature_url)?.seller_signature_url || ''));
                      const sellerAadhaar = seller._local_aadhaar || (seller.aadhaar_photo_url && seller.aadhaar_photo_url.startsWith('data:') ? seller.aadhaar_photo_url : '');

                      return `
                        <div class="data-card seller-card">
                            <div class="card-head">
                                <div>
                                    <h3 class="card-title">${seller.name}</h3>
                                    <span class="meta-sub">📞 ${seller.phone} • Registered: ${seller.created_at ? new Date(seller.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}</span>
                                </div>
                                <span class="badge badge-seller">${(seller.id_proof_type || 'Aadhaar').toUpperCase()}</span>
                            </div>

                            <!-- Rich Media Row: Photo, Info, Signature -->
                            <div class="seller-preview-row" style="margin-bottom: 14px;">
                                ${sellerPhoto ? `
                                <div class="seller-photo-wrap">
                                    <img src="${sellerPhoto}" alt="${seller.name}" class="seller-mini-photo" onclick="openImageModal(this.src)" title="Click to enlarge seller photo" onerror="this.style.display='none'" />
                                </div>` : `
                                <div class="seller-photo-wrap avatar-fallback">
                                    <span>👤</span>
                                </div>`}
                                <div class="seller-text-wrap">
                                    <p><strong>ID Number:</strong> <code>${seller.id_number || 'Verified'}</code></p>
                                    <p class="seller-addr"><strong>Address:</strong> ${seller.address || 'N/A'}</p>
                                    <p><strong>Devices Sold to Shop:</strong> <span class="price-val">${relatedPhones.length} Devices</span></p>
                                    <p><strong>Total Payout to Seller:</strong> <span class="price-val">₹${totalPaid.toLocaleString('en-IN')}</span></p>
                                </div>
                                ${sellerSig ? `
                                <div class="signature-wrap" title="Digital Signature on Sapath Patra">
                                    <span class="sig-label">Digital Signature</span>
                                    <img src="${sellerSig}" alt="Signature" class="seller-mini-sig" onclick="openImageModal(this.src)" onerror="this.style.display='none'" />
                                </div>` : ''}
                            </div>

                            ${sellerAadhaar ? `
                            <div class="gallery-block">
                                <h5>📄 Aadhaar / KYC Document Copy</h5>
                                <img src="${sellerAadhaar}" alt="Aadhaar Document" class="thumb-img" style="width: 110px; height: 75px;" onclick="openImageModal(this.src)" onerror="this.style.display='none'" />
                            </div>` : ''}

                            <!-- Sold Phones History by this Seller -->
                            ${relatedPhones.length > 0 ? `
                            <div class="batches-subtable" style="margin-top: 12px;">
                                <h5>📱 Phones Acquired from this Seller (${relatedPhones.length})</h5>
                                <ul>
                                    ${relatedPhones.map((rp: any) => `
                                        <li>
                                            <strong>${rp.phone_name} ${rp.model}</strong> 
                                            (IMEI: <code>${rp.imei_number}</code>) • 
                                            <span class="price-val">Purchase: ₹${(Number(rp.purchase_price) || 0).toLocaleString('en-IN')}</span> • 
                                            <span>${rp.purchase_date || 'N/A'}</span> • 
                                            <span class="badge ${rp.is_sold ? 'badge-sold' : 'badge-available'}" style="font-size: 0.65rem; padding: 2px 6px;">
                                                ${rp.is_sold ? 'SOLD' : 'IN STOCK'}
                                            </span>
                                        </li>
                                    `).join('')}
                                </ul>
                            </div>` : ''}
                        </div>
                      `;
                    }).join('')}
                </div>
            </section>

            <!-- ========================================== -->
            <!-- TAB 5: VALUED CUSTOMERS -->
            <!-- ========================================== -->
            <section id="tab-customers" class="tab-content">
                <div class="tab-header">
                    <div>
                        <h2>Valued Customers & Purchase History</h2>
                        <span class="meta-sub">Buyer profiles, contact numbers, and total retail spend</span>
                    </div>
                    <span class="count-tag">${customersList.length} Customers</span>
                </div>
                <div class="cards-grid">
                    ${customersList.length === 0 ? `<p class="empty-notice">No customer records exported.</p>` : customersList.map((customer: any) => {
                      const purchasedPhones = phonesList.filter((p: any) => p.customer_id === customer.id || p.buyer_name === customer.name);
                      const totalSpend = purchasedPhones.reduce((sum: number, p: any) => sum + (Number(p.sold_price || p.selling_price) || 0), 0);

                      return `
                        <div class="data-card customer-card">
                            <div class="card-head">
                                <div>
                                    <h3 class="card-title">${customer.name}</h3>
                                    <span class="meta-sub">📞 ${customer.phone || 'N/A'} • Customer since ${customer.created_at ? new Date(customer.created_at).toLocaleDateString() : '2026'}</span>
                                </div>
                                <span class="badge badge-customer">CUSTOMER</span>
                            </div>

                            <div class="details-grid">
                                <div class="detail-item"><strong>Address:</strong> ${customer.address || 'N/A'}</div>
                                <div class="detail-item"><strong>Phones Bought:</strong> <span class="price-val">${purchasedPhones.length} Devices</span></div>
                                <div class="detail-item"><strong>Total Spend:</strong> <span class="price-val">₹${totalSpend.toLocaleString('en-IN')}</span></div>
                            </div>

                            ${purchasedPhones.length > 0 ? `
                            <div class="batches-subtable">
                                <h5>🛍️ Purchases from Store (${purchasedPhones.length})</h5>
                                <ul>
                                    ${purchasedPhones.map((pp: any) => `
                                        <li>
                                            <strong>${pp.phone_name} ${pp.model}</strong> • 
                                            <span class="price-val">₹${(Number(pp.sold_price || pp.selling_price) || 0).toLocaleString('en-IN')}</span> • 
                                            <span>${pp.sold_date ? new Date(pp.sold_date).toLocaleDateString() : 'N/A'}</span>
                                        </li>
                                    `).join('')}
                                </ul>
                            </div>` : ''}
                        </div>
                      `;
                    }).join('')}
                </div>
            </section>

            <!-- ========================================== -->
            <!-- TAB 6: MESSAGES -->
            <!-- ========================================== -->
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
                                <h3 class="card-title">${m.name} (${m.phone || m.email || ''})</h3>
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

        function filterPhoneStock(filter, btn) {
            document.querySelectorAll('.subfilter-group .sub-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const cards = document.querySelectorAll('#tab-phones .phone-card');
            cards.forEach(card => {
                const stock = card.getAttribute('data-stock');
                if (filter === 'all' || stock === filter) {
                    card.style.display = '';
                } else {
                    card.style.display = 'none';
                }
            });
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
    background-color: #060911;
    min-height: 100vh;
}

.app-layout {
    max-width: 1480px;
    margin: 0 auto;
    padding: 24px 20px 60px;
}

.app-header {
    background: #0d1322;
    border: 1px solid #1e293b;
    border-radius: 16px;
    padding: 24px;
    margin-bottom: 24px;
    box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.7);
}

.brand-bar {
    display: flex;
    align-items: center;
    gap: 18px;
    margin-bottom: 20px;
}

.brand-logo {
    font-size: 2.2rem;
    background: linear-gradient(135deg, #10b981, #06b6d4);
    border-radius: 14px;
    width: 60px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 24px rgba(16, 185, 129, 0.45);
    flex-shrink: 0;
}

.brand-info h1 {
    font-size: 1.85rem;
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
    gap: 12px;
    margin-bottom: 20px;
}

.stat-pill {
    background: #131d33;
    border: 1px solid #1e293b;
    border-radius: 10px;
    padding: 8px 16px;
    display: flex;
    align-items: center;
    gap: 10px;
}

.stat-val {
    font-size: 1.15rem;
    font-weight: 800;
    color: #10b981;
}

.stat-lbl {
    font-size: 0.82rem;
    color: #cbd5e1;
    font-weight: 600;
}

.search-box-wrap {
    margin-bottom: 20px;
}

#offlineSearch {
    width: 100%;
    padding: 14px 20px;
    background: #070b14;
    border: 1px solid #283548;
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
    gap: 10px;
    border-top: 1px solid #1e293b;
    padding-top: 16px;
}

.tab-btn {
    background: #131d33;
    color: #cbd5e1;
    border: 1px solid #283548;
    padding: 10px 20px;
    border-radius: 10px;
    font-weight: 700;
    font-size: 0.88rem;
    cursor: pointer;
    transition: all 0.2s;
}

.tab-btn:hover {
    background: #1e2b48;
    color: #ffffff;
    border-color: #3b82f6;
}

.tab-btn.active {
    background: #10b981;
    border-color: #10b981;
    color: #ffffff;
    box-shadow: 0 4px 16px rgba(16, 185, 129, 0.45);
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
    flex-wrap: wrap;
    gap: 16px;
    margin-bottom: 20px;
}

.tab-header h2 {
    font-size: 1.45rem;
    font-weight: 800;
    color: #ffffff;
}

.subfilter-group {
    display: flex;
    gap: 8px;
}

.sub-btn {
    background: #131d33;
    color: #94a3b8;
    border: 1px solid #283548;
    padding: 6px 14px;
    border-radius: 8px;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s;
}

.sub-btn:hover {
    background: #1e2b48;
    color: #ffffff;
}

.sub-btn.active {
    background: #3b82f6;
    border-color: #3b82f6;
    color: #ffffff;
}

.count-tag {
    background: #131d33;
    color: #10b981;
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 0.82rem;
    font-weight: 700;
    border: 1px solid #283548;
}

.cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
    gap: 22px;
}

.data-card {
    background: #0d1322;
    border: 1px solid #1e293b;
    border-radius: 14px;
    padding: 22px;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
    transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
    display: flex;
    flex-direction: column;
}

.data-card:hover {
    border-color: #38bdf8;
    transform: translateY(-3px);
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.6);
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
    font-size: 1.2rem;
    font-weight: 700;
    color: #ffffff;
}

.meta-sub {
    font-size: 0.8rem;
    color: #94a3b8;
    display: block;
    margin-top: 3px;
}

.badge-stack {
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: flex-end;
}

.badge {
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 0.72rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    display: inline-block;
}

.badge-available { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid #10b981; }
.badge-sold { background: rgba(168, 85, 247, 0.18); color: #c084fc; border: 1px solid #a855f7; }
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
    font-size: 0.78rem;
    display: block;
}

.price-val {
    color: #10b981;
    font-weight: 700;
}

.cond-val {
    color: #38bdf8;
    font-weight: 700;
}

.profit-val { font-weight: 700; }
.profit-pos { color: #10b981; }
.profit-neg { color: #ef4444; }

code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    background: #172033;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.8rem;
    color: #38bdf8;
    border: 1px solid #283548;
}

.customer-strip {
    background: #131d33;
    border-left: 3px solid #3b82f6;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 0.85rem;
    margin-bottom: 12px;
}

.problem-box {
    background: #161b26;
    border: 1px solid #283548;
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 0.85rem;
    margin-bottom: 14px;
    color: #fca5a5;
}

.problem-box strong {
    color: #f87171;
    display: block;
    margin-bottom: 4px;
    font-size: 0.8rem;
}

.info-block {
    background: #080d18;
    border: 1px solid #1e293b;
    border-radius: 10px;
    padding: 12px;
    font-size: 0.82rem;
    margin-bottom: 12px;
}

.info-block h4 {
    font-size: 0.84rem;
    font-weight: 700;
    color: #38bdf8;
    margin-bottom: 8px;
    border-bottom: 1px dashed #1e293b;
    padding-bottom: 4px;
}

/* Seller Preview Row with Photo, Text, and Signature */
.seller-preview-row {
    display: flex;
    align-items: center;
    gap: 12px;
}

.seller-photo-wrap {
    flex-shrink: 0;
}

.seller-mini-photo {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid #10b981;
    cursor: pointer;
    box-shadow: 0 0 10px rgba(16, 185, 129, 0.3);
    transition: transform 0.2s;
}

.seller-mini-photo:hover {
    transform: scale(1.1);
}

.avatar-fallback {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: #1e293b;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.8rem;
    border: 2px solid #334155;
}

.seller-text-wrap {
    flex: 1;
    font-size: 0.8rem;
    line-height: 1.4;
}

.seller-addr {
    color: #94a3b8;
    font-size: 0.76rem;
    margin-top: 2px;
}

.signature-wrap {
    flex-shrink: 0;
    text-align: center;
    background: #ffffff;
    border-radius: 6px;
    padding: 4px 6px;
    border: 1px solid #cbd5e1;
}

.sig-label {
    display: block;
    font-size: 0.65rem;
    color: #475569;
    font-weight: 700;
    margin-bottom: 2px;
}

.seller-mini-sig {
    width: 80px;
    height: 38px;
    object-fit: contain;
    cursor: pointer;
}

.gallery-block {
    margin-top: 10px;
    border-top: 1px solid #1e293b;
    padding-top: 10px;
}

.gallery-block h5 {
    font-size: 0.78rem;
    color: #94a3b8;
    margin-bottom: 8px;
    font-weight: 600;
}

.img-thumbnails {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.thumb-img {
    width: 68px;
    height: 68px;
    object-fit: cover;
    border-radius: 8px;
    border: 1px solid #283548;
    cursor: pointer;
    transition: transform 0.2s, border-color 0.2s;
}

.thumb-img:hover {
    transform: scale(1.08);
    border-color: #10b981;
}

.batches-subtable {
    margin-top: 12px;
    background: #080d18;
    padding: 10px 12px;
    border-radius: 8px;
    font-size: 0.8rem;
    border: 1px solid #1e293b;
}

.batches-subtable h5 {
    color: #06b6d4;
    margin-bottom: 6px;
    font-weight: 700;
}

.batches-subtable ul {
    list-style: none;
    padding-left: 0;
}

.batches-subtable li {
    padding: 4px 0;
    border-bottom: 1px solid #172033;
    line-height: 1.4;
}

.batches-subtable li:last-child {
    border-bottom: none;
}

.empty-notice {
    grid-column: 1 / -1;
    text-align: center;
    padding: 60px 20px;
    color: #64748b;
    font-size: 1rem;
}

/* Lightbox Modal */
.modal {
    display: none;
    position: fixed;
    z-index: 9999;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.92);
    align-items: center;
    justify-content: center;
}

.modal-content {
    max-width: 90%;
    max-height: 85%;
    border-radius: 10px;
    box-shadow: 0 0 35px rgba(0, 0, 0, 0.9);
}

.close-btn {
    position: absolute;
    top: 20px;
    right: 30px;
    color: #f1f5f9;
    font-size: 42px;
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
    .seller-preview-row {
        flex-direction: column;
        align-items: flex-start;
    }
}
`;
}
