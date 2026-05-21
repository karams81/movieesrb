<?php
class M3UBuilder {
    private $outputFile;
    
    public function __construct($outputFile) {
        $this->outputFile = $outputFile;
        $dir = dirname($outputFile);
        if (!is_dir($dir)) mkdir($dir, 0755, true);
    }
    
    public function build($movies) {
        $content = "#EXTM3U\n";
        $content .= "# OK.ru Movie Bot - " . date('Y-m-d H:i:s') . "\n";
        $content .= "# Toplam Film: " . count($movies) . "\n\n";
        
        foreach ($movies as $movie) {
            $duration = (int)$movie['duration'];
            $title = str_replace(["\n", "\r", ','], '', $movie['title']);
            
            $content .= "#EXTINF:{$duration},{$title}\n";
            $content .= "# {$movie['source']} | İzlenme: " . number_format($movie['views']) . "\n";
            $content .= $movie['url'] . "\n\n";
        }
        
        file_put_contents($this->outputFile, $content);
        return count($movies);
    }
}
?>
