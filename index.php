#!/usr/bin/env php
<?php
require_once __DIR__ . '/sources/okru.php';
require_once __DIR__ . '/core/m3u-builder.php';

echo "[" . date('Y-m-d H:i:s') . "] OK.ru Film Bot Başladı\n";

try {
    $okru = new OKruSource();
    echo "Filmler taranıyor...\n";
    
    $movies = $okru->getPopularMovies(100);
    echo count($movies) . " film bulundu.\n";
    
    $builder = new M3UBuilder(__DIR__ . '/output/movies.m3u');
    $total = $builder->build($movies);
    
    echo "✅ {$total} film M3U dosyasına kaydedildi.\n";
    echo "Çıktı: output/movies.m3u\n";
    
} catch (Exception $e) {
    echo "❌ Hata: " . $e->message() . "\n";
    exit(1);
}
?>
