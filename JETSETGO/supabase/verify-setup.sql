-- =====================================================
-- JETSETGO - Verify Database Setup
-- Run this in Supabase SQL Editor to check all tables
-- =====================================================

-- Check pgvector extension
SELECT 'pgvector extension' AS check_name,
       CASE WHEN EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector')
            THEN '✅ Installed'
            ELSE '❌ Not found' END AS status;

-- Check all tables
SELECT 'parts_catalog' AS table_name,
       CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'parts_catalog')
            THEN '✅ Created'
            ELSE '❌ Missing' END AS status;

SELECT 'tires_catalog' AS table_name,
       CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'tires_catalog')
            THEN '✅ Created'
            ELSE '❌ Missing' END AS status;

SELECT 'catalog_sources' AS table_name,
       CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'catalog_sources')
            THEN '✅ Created'
            ELSE '❌ Missing' END AS status;

SELECT 'vehicle_compatibility' AS table_name,
       CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicle_compatibility')
            THEN '✅ Created'
            ELSE '❌ Missing' END AS status;

SELECT 'ingestion_jobs' AS table_name,
       CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'ingestion_jobs')
            THEN '✅ Created'
            ELSE '❌ Missing' END AS status;

SELECT 'ingestion_logs' AS table_name,
       CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'ingestion_logs')
            THEN '✅ Created'
            ELSE '❌ Missing' END AS status;

SELECT 'ocr_results' AS table_name,
       CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'ocr_results')
            THEN '✅ Created'
            ELSE '❌ Missing' END AS status;

SELECT 'extraction_results' AS table_name,
       CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'extraction_results')
            THEN '✅ Created'
            ELSE '❌ Missing' END AS status;

SELECT 'validation_queue' AS table_name,
       CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'validation_queue')
            THEN '✅ Created'
            ELSE '❌ Missing' END AS status;

SELECT 'linebot_sessions' AS table_name,
       CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'linebot_sessions')
            THEN '✅ Created'
            ELSE '❌ Missing' END AS status;

SELECT 'search_logs' AS table_name,
       CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'search_logs')
            THEN '✅ Created'
            ELSE '❌ Missing' END AS status;

SELECT 'conversation_messages' AS table_name,
       CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'conversation_messages')
            THEN '✅ Created'
            ELSE '❌ Missing' END AS status;

SELECT 'product_inquiries' AS table_name,
       CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'product_inquiries')
            THEN '✅ Created'
            ELSE '❌ Missing' END AS status;

SELECT 'follow_up_suggestions' AS table_name,
       CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'follow_up_suggestions')
            THEN '✅ Created'
            ELSE '❌ Missing' END AS status;

-- Check HNSW indexes
SELECT 'idx_parts_embedding_hnsw' AS index_name,
       CASE WHEN EXISTS(SELECT 1 FROM pg_indexes WHERE indexname = 'idx_parts_embedding_hnsw')
            THEN '✅ Created'
            ELSE '❌ Missing' END AS status;

SELECT 'idx_tires_embedding_hnsw' AS index_name,
       CASE WHEN EXISTS(SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tires_embedding_hnsw')
            THEN '✅ Created'
            ELSE '❌ Missing' END AS status;

-- Check functions
SELECT 'jetsetgo_search_parts_semantic' AS function_name,
       CASE WHEN EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'jetsetgo_search_parts_semantic')
            THEN '✅ Created'
            ELSE '❌ Missing' END AS status;

SELECT 'jetsetgo_search_tires_semantic' AS function_name,
       CASE WHEN EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'jetsetgo_search_tires_semantic')
            THEN '✅ Created'
            ELSE '❌ Missing' END AS status;

SELECT 'jetsetgo_search_by_vehicle' AS function_name,
       CASE WHEN EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'jetsetgo_search_by_vehicle')
            THEN '✅ Created'
            ELSE '❌ Missing' END AS status;

-- Check storage bucket
SELECT 'jetsetgo-catalogs bucket' AS storage_name,
       CASE WHEN EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'jetsetgo-catalogs')
            THEN '✅ Created'
            ELSE '❌ Missing' END AS status;

-- Count records in each table
SELECT 'Record counts:' AS info;

SELECT 'parts_catalog' AS table_name, COUNT(*) AS record_count FROM parts_catalog
UNION ALL
SELECT 'tires_catalog', COUNT(*) FROM tires_catalog
UNION ALL
SELECT 'catalog_sources', COUNT(*) FROM catalog_sources
UNION ALL
SELECT 'linebot_sessions', COUNT(*) FROM linebot_sessions
UNION ALL
SELECT 'search_logs', COUNT(*) FROM search_logs;
